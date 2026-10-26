import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { complete, useCompleted } from './challenges.ts'
import { CRUDES } from './crudes.ts'
import { SulphurIcon } from './icons.tsx'
import { controls, treatingResult, usePlant, type Plant, type TreatingResult } from './plant.ts'
import { DHT_LIMITS, SRU_LIMITS } from './treating.ts'
import { TreatingPfd } from './TreatingPfd.tsx'
import { TREATING_TASKS } from './treatingTasks.ts'
import { Slider } from './ui.tsx'
import './Refinery.css'

type Tab = 'operate' | 'shift' | 'learn'

/** The diesel hydrotreater, the hydrogen header and the sulphur plant: where the crude's sulphur ends up. */
export function TreatingPanel() {
  const plant = usePlant((p) => p)
  const result = useMemo(() => treatingResult(plant), [plant])
  const [tab, setTab] = useState<Tab>('operate')

  useEffect(() => {
    for (const t of TREATING_TASKS) if (t.met(plant, result)) complete(t.id)
  }, [plant, result])

  return (
    <Panel
      title="Hydrotreating and sulphur recovery"
      subtitle="Units 600 and 700 at Marshgate: road diesel, the hydrogen header, and where the sulphur goes"
      icon={<SulphurIcon />}
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
            Fed by every unit upstream: {CRUDES[plant.furnace.crude].name} at {plant.furnace.feed.toFixed(0)} kb/d
          </span>
        </div>
        <TreatingPfd plant={plant} result={result} />
        {tab === 'operate' && <Operate plant={plant} result={result} />}
        {tab === 'shift' && <Shift plant={plant} result={result} />}
        {tab === 'learn' && <Learn />}
      </div>
    </Panel>
  )
}

function Operate({ plant, result }: { plant: Plant; result: TreatingResult }) {
  const { dht, sru, hydrogen } = result
  const warnings = [...dht.warnings, ...sru.warnings]
  const sourceTotal = result.sulphurSources.reduce((sum, s) => sum + s.tonnes, 0)
  return (
    <div className="cdu-grid">
      <section className="cdu-card">
        <h3>Diesel hydrotreater</h3>
        <p className="cdu-note">
          Straight-run diesel arrives at {result.conversion.cdu.products.diesel.rate.toFixed(1)} kb/d with{' '}
          {result.conversion.cdu.products.diesel.sulphurPpm.toFixed(0)} ppm of sulphur. The cat cracker's light cycle oil (
          {result.lco.rate.toFixed(1)} kb/d, {result.lco.sulphur.toFixed(0)} ppm) can join it.
        </p>
        <Slider
          label="Reactor inlet"
          value={plant.dht.temp}
          min={DHT_LIMITS.temp.min}
          max={DHT_LIMITS.temp.max}
          step={1}
          unit="°C"
          onChange={(temp) => controls.setDht({ temp })}
        />
        <Slider
          label="Hydrogen pressure"
          value={plant.dht.pressure}
          min={DHT_LIMITS.pressure.min}
          max={DHT_LIMITS.pressure.max}
          step={1}
          unit="bar"
          onChange={(pressure) => controls.setDht({ pressure })}
        />
        <div className="cdu-row">
          <span>Light cycle oil</span>
          <div className="segmented">
            <button className="button" aria-pressed={!plant.dht.lco} onClick={() => controls.setDht({ lco: false })}>
              To fuel oil
            </button>
            <button className="button" aria-pressed={plant.dht.lco} onClick={() => controls.setDht({ lco: true })}>
              Into diesel
            </button>
          </div>
        </div>
        <dl className="cdu-readings">
          <dt>Feed</dt>
          <dd>
            {dht.feedRate.toFixed(1)} kb/d at {dht.sulphurIn.toFixed(0)} ppm
          </dd>
          <dt>Diesel sulphur</dt>
          <dd className={dht.onSpec ? 'cdu-good' : 'cdu-bad'}>
            {dht.sulphurOut < 1 ? dht.sulphurOut.toFixed(2) : dht.sulphurOut.toFixed(1)} ppm{' '}
            <small className="muted">(road limit {DHT_LIMITS.sulphurMax})</small>
          </dd>
          <dt>Hydrogen used</dt>
          <dd>
            {dht.hydrogen.toFixed(1)} t/d <small className="muted">({dht.hydrogenPct.toFixed(2)} wt% of feed)</small>
          </dd>
        </dl>
        <h3>Hydrogen header</h3>
        <Balance
          supply={{ name: 'Reformer', tonnes: hydrogen.supply }}
          users={hydrogen.users}
          unit="t/d"
          short={hydrogen.imported > 0 ? `${hydrogen.imported.toFixed(1)} t/d bought from a steam methane reformer` : undefined}
          spare={hydrogen.surplus > 0 ? `${hydrogen.surplus.toFixed(1)} t/d spare, burned as fuel gas` : undefined}
        />
      </section>

      <section className="cdu-card">
        <h3>Sulphur recovery</h3>
        <p className="cdu-note">
          The crude brings in {result.crudeSulphur.toFixed(0)} t/d of sulphur. {sourceTotal.toFixed(1)} t/d of it reaches the sulphur
          plant as hydrogen sulphide; the rest leaves in the residue, fuel oil and coke.
        </p>
        <Balance supply={null} users={result.sulphurSources} unit="t/d" />
        <Slider
          label="Combustion air"
          value={plant.sru.air}
          min={SRU_LIMITS.air.min}
          max={SRU_LIMITS.air.max}
          step={0.5}
          unit="%"
          digits={1}
          onChange={(air) => controls.setSru({ air })}
        />
        <div className="cdu-row">
          <span>Converters</span>
          <div className="segmented">
            {([2, 3] as const).map((n) => (
              <button key={n} className="button" aria-pressed={plant.sru.converters === n} onClick={() => controls.setSru({ converters: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="cdu-row">
          <span>Tail gas unit</span>
          <div className="segmented">
            <button className="button" aria-pressed={!plant.sru.tailGas} onClick={() => controls.setSru({ tailGas: false })}>
              Off
            </button>
            <button className="button" aria-pressed={plant.sru.tailGas} onClick={() => controls.setSru({ tailGas: true })}>
              On
            </button>
          </div>
        </div>
        <dl className="cdu-readings">
          <dt>Tail gas H₂S : SO₂</dt>
          <dd className={Math.abs(plant.sru.air - 100) >= 4 ? 'cdu-bad' : ''}>
            {sru.ratio.toFixed(2)} : 1 <small className="muted">(aim for 2 : 1)</small>
          </dd>
          <dt>Recovery</dt>
          <dd>{sru.recovery.toFixed(2)}%</dd>
          <dt>Liquid sulphur</dt>
          <dd>{sru.sulphur.toFixed(1)} t/d</dd>
          <dt>SO₂ to the stack</dt>
          <dd className={sru.so2 > SRU_LIMITS.so2Permit ? 'cdu-bad' : 'cdu-good'}>
            {sru.so2.toFixed(2)} t/d <small className="muted">(permit {SRU_LIMITS.so2Permit})</small>
          </dd>
        </dl>
      </section>

      <section className="cdu-card cdu-wide">
        <h3>Warnings</h3>
        {warnings.length === 0 ? (
          <p className="muted">Nothing to report. Diesel is on spec and the stack is inside its permit.</p>
        ) : (
          <ul className="cdu-alarms">
            {warnings.map((w) => (
              <li key={w} className="cdu-alarm-active cdu-alarm-low">
                {w}
              </li>
            ))}
          </ul>
        )}
        <button className="button button-quiet" onClick={controls.resetTreating}>
          Reset both units to design
        </button>
      </section>
    </div>
  )
}

const SOURCE_COLOURS = ['#e8d27a', '#f0a64a', '#d9733c', '#9fb7a0', '#a9c9e8']

/** Who makes and who uses a stream, as one stacked bar with a legend. */
function Balance({
  supply,
  users,
  unit,
  short,
  spare,
}: {
  supply: { name: string; tonnes: number } | null
  users: { name: string; tonnes: number }[]
  unit: string
  short?: string
  spare?: string
}) {
  const used = users.reduce((sum, u) => sum + u.tonnes, 0)
  const scale = Math.max(used, supply?.tonnes ?? 0) || 1
  return (
    <div className="cv-heat">
      {supply && (
        <div className="cv-heat-row">
          <span>{supply.name}</span>
          <div className="cv-stack">
            <div style={{ width: `${(supply.tonnes / scale) * 100}%`, background: '#a9c9e8' }} />
          </div>
          <output>
            {supply.tonnes.toFixed(1)} {unit}
          </output>
        </div>
      )}
      <div className="cv-heat-row">
        <span>{supply ? 'Users' : 'From'}</span>
        <div className="cv-stack">
          {users.map((u, i) => (
            <div key={u.name} style={{ width: `${(u.tonnes / scale) * 100}%`, background: SOURCE_COLOURS[i % SOURCE_COLOURS.length] }} />
          ))}
        </div>
        <output>
          {used.toFixed(1)} {unit}
        </output>
      </div>
      <ul className="cv-legend">
        {users.map((u, i) => (
          <li key={u.name}>
            <span className="cdu-swatch" style={{ background: SOURCE_COLOURS[i % SOURCE_COLOURS.length] }} /> {u.name}{' '}
            <strong>{u.tonnes.toFixed(1)}</strong>
          </li>
        ))}
      </ul>
      {short && <p className="cdu-note cdu-bad">{short}</p>}
      {spare && <p className="cdu-note">{spare}</p>}
    </div>
  )
}

function Shift({ plant, result }: { plant: Plant; result: TreatingResult }) {
  const completed = useCompleted()
  return (
    <div className="cdu-shift">
      <p>Requests from the planners and the environmental team. Each is done as soon as you meet it, and progress is saved in this browser.</p>
      <ol className="cdu-tasks">
        {TREATING_TASKS.map((t) => {
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
      <h3>Why take the sulphur out</h3>
      <p>
        Sulphur burned in an engine becomes sulphur dioxide, which makes acid rain and poisons the catalytic converters and particulate
        filters that clean exhaust. Since 2009, road diesel in Europe may carry no more than 10 parts per million, a thousandth of what
        the crude unit sends out. Taking it out is one of the biggest jobs a modern refinery does.
      </p>
      <h3>The hydrotreater</h3>
      <p>
        Gas oil is mixed with hydrogen, heated to about 340–380 °C and passed down a reactor full of cobalt–molybdenum or
        nickel–molybdenum sulphide catalyst at 30–80 bar. The hydrogen breaks the carbon–sulphur bonds, and the sulphur leaves as
        hydrogen sulphide (R–S–R′ + 2 H₂ → R–H + R′–H + H₂S). A separator and stripper take the gas off the treated diesel.
      </p>
      <p>
        Most sulphur compounds react easily. The last few hundred ppm are in dibenzothiophenes with methyl groups either side of the
        sulphur atom (4,6-dimethyldibenzothiophene), which can't lie flat on the catalyst. They react slowly, and mainly by a route
        that first saturates a ring with hydrogen, which is why pressure matters so much for ultra-low sulphur diesel. Cracked stocks
        like the cat cracker's light cycle oil are full of them, and their aromatics and nitrogen crowd the catalyst too.
      </p>
      <h3>Hydrogen</h3>
      <p>
        Every hydrotreater needs hydrogen, for the sulphur and even more for saturating aromatics. The reformer makes it as a by-product.
        When that isn't enough (and in refineries with hydrocrackers it never is), hydrogen is made on purpose in a steam methane
        reformer, from natural gas, at a cost in money and carbon dioxide. Running a hydrotreater at more pressure than it needs
        wastes hydrogen on aromatics.
      </p>
      <h3>The amine unit and the Claus process</h3>
      <p>
        The sour gas from every hydrotreater and the cat cracker is washed with an amine solution, which absorbs the hydrogen sulphide
        and gives it back up as a concentrated acid gas when heated in a regenerator. That goes to a Claus plant, named after Carl
        Friedrich Claus, who patented it in 1883. A third of the H₂S is burned to SO₂ in a furnace, and the two react: 2 H₂S + SO₂ →
        3 S + 2 H₂O. About two thirds of the sulphur forms in the furnace; the rest in two or three catalytic converters, with the
        sulphur condensed out as a yellow liquid between each one.
      </p>
      <p>
        Everything depends on the air. Too little and H₂S is left over; too much and SO₂ is. Either way it ends up at the incinerator
        and goes up the stack as SO₂. Operators trim the air to hold an analyser on the tail gas at 2:1. Even a perfect Claus plant
        misses about 3%, so most refineries add a tail gas unit, which turns what's left back into H₂S and returns it, for 99.9%
        recovery.
      </p>
      <h3>About this model</h3>
      <p className="muted">
        Desulphurisation is two first-order lumps (easy and sterically hindered sulphur) with their own activation energies and
        pressure orders, inhibited by cycle oil. Hydrogen use is lumped from typical consumption for straight-run and cracked gas oil.
        Claus recovery falls with the square of the air error and rises with each converter, shaped to published data (Kohl and
        Nielsen, Gas Purification). Typical, not a design tool.
      </p>
    </div>
  )
}
