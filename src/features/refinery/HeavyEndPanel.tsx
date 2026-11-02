import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { complete } from './challenges.ts'
import { usePlantClock } from './clock.ts'
import { CRUDES } from './crudes.ts'
import {
  COKER_LIMITS,
  drumCycle,
  HC_LIMITS,
  reformerEquilibrium,
  runHydrocracker,
  SMR_LIMITS,
} from './heavyEnd.ts'
import { HEAVY_END_TASKS } from './heavyEndTasks.ts'
import { CokerIcon } from './icons.tsx'
import { Tag } from './Pfd.tsx'
import { controls, treatingResult, usePlant, type Plant, type TreatingResult } from './plant.ts'
import { SITE_PRICES } from './site.ts'
import { CurveChart, ScreenTabs, Slider, TaskList, Warnings, type ScreenTab } from './ui.tsx'
import './Refinery.css'

type Unit = 'coker' | 'hydrocracker' | 'smr'

/** The bottom of the barrel: the delayed coker, the hydrocracker and the hydrogen plant that feeds it. */
export function HeavyEndPanel() {
  usePlantClock()
  const plant = usePlant((p) => p)
  const result = useMemo(() => treatingResult(plant), [plant])
  const [tab, setTab] = useState<ScreenTab>('operate')
  const [unit, setUnit] = useState<Unit>('coker')

  useEffect(() => {
    for (const t of HEAVY_END_TASKS) if (t.met(plant, result)) complete(t.id)
  }, [plant, result])

  return (
    <Panel title="Heavy end: coker, hydrocracker and hydrogen" subtitle="Units 1200 to 1400 at Marshgate: the bottom of the barrel, upgraded" icon={<CokerIcon />} wide>
      <div className="cdu">
        <ScreenTabs
          tab={tab}
          onChange={setTab}
          aside={
            <div className="segmented" aria-label="Unit">
              {(
                [
                  ['coker', 'Coker'],
                  ['hydrocracker', 'Hydrocracker'],
                  ['smr', 'Hydrogen plant'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} className="button" aria-pressed={unit === id} onClick={() => setUnit(id)}>
                  {label}
                </button>
              ))}
            </div>
          }
        />
        {tab === 'operate' && unit === 'coker' && <Coker plant={plant} result={result} />}
        {tab === 'operate' && unit === 'hydrocracker' && <Hydrocracker plant={plant} result={result} />}
        {tab === 'operate' && unit === 'smr' && <Smr plant={plant} result={result} />}
        {tab === 'shift' && (
          <TaskList
            intro="The heavy end has just been built. Bring each unit on line, then push it. Progress is saved in this browser."
            tasks={HEAVY_END_TASKS}
            plant={plant}
            result={result}
          />
        )}
        {tab === 'learn' && <Learn />}
      </div>
    </Panel>
  )
}

function RunSwitch({ running, onChange, label }: { running: boolean; onChange: (running: boolean) => void; label: string }) {
  return (
    <div className="cdu-row">
      <span>{label}</span>
      <div className="segmented">
        <button className="button" aria-pressed={!running} onClick={() => onChange(false)}>
          Shut down
        </button>
        <button className="button" aria-pressed={running} onClick={() => onChange(true)}>
          Running
        </button>
      </div>
    </div>
  )
}

/* ---------------- Coker ---------------- */

function Coker({ plant, result }: { plant: Plant; result: TreatingResult }) {
  const { coker, vdu } = result.conversion
  const hours = plant.furnace.time / 3600
  const cycle = drumCycle(hours, plant.coker.cycle)
  const yields = coker.yields
  const parts = [
    ['Gas', yields.gas, '#8fa6b8'],
    ['LPG', yields.lpg, '#9fd0e0'],
    ['Naphtha', yields.naphtha, '#e8e2a8'],
    ['Gas oil', yields.gasOil, '#d9733c'],
    ['Coke', yields.coke, '#4a4a4a'],
  ] as const
  const fillCurve: [number, number][] = Array.from({ length: 49 }, (_, i) => {
    const h = (i / 48) * COKER_LIMITS.cycle.max
    return [h, Math.min(130, ((coker.rates.coke / 24) * h) / COKER_LIMITS.cokeDensity / COKER_LIMITS.drumVolume * 100)]
  })
  return (
    <>
      <CokerPfd plant={plant} result={result} cycle={cycle} />
      <div className="cdu-grid">
        <section className="cdu-card">
          <h3>Delayed coker</h3>
          <p className="cdu-note">
            {vdu.residueRate.toFixed(1)} kb/d of vacuum residue from {CRUDES[plant.furnace.crude].name}, {coker.ccr.toFixed(0)}% Conradson carbon. Running, the
            coker takes all of it; shut down, it goes to fuel oil at ${SITE_PRICES.residue} a barrel.
          </p>
          <RunSwitch label="Unit" running={plant.coker.running} onChange={(running) => controls.setCoker({ running })} />
          <Slider label="Heater outlet" value={plant.coker.heater} min={COKER_LIMITS.heater.min} max={COKER_LIMITS.heater.max} step={1} unit="°C" onChange={(heater) => controls.setCoker({ heater })} />
          <Slider label="Drum pressure" value={plant.coker.pressure} min={COKER_LIMITS.pressure.min} max={COKER_LIMITS.pressure.max} step={0.1} digits={1} unit="barg" onChange={(pressure) => controls.setCoker({ pressure })} />
          <Slider label="Recycle ratio" value={plant.coker.recycle} min={COKER_LIMITS.recycle.min} max={COKER_LIMITS.recycle.max} step={0.01} digits={2} unit="" onChange={(recycle) => controls.setCoker({ recycle })} />
          <Slider label="Drum cycle" value={plant.coker.cycle} min={COKER_LIMITS.cycle.min} max={COKER_LIMITS.cycle.max} step={1} unit="h" onChange={(cycle) => controls.setCoker({ cycle })} />
          <h3>Yields on feed</h3>
          <div className="cv-stack bl-yield" role="img" aria-label="Coker yields">
            {parts.map(([name, v, c]) => (
              <div key={name} style={{ width: `${v}%`, background: c }} title={`${name} ${v.toFixed(1)} wt%`} />
            ))}
          </div>
          <ul className="cv-legend">
            {parts.map(([name, v, c]) => (
              <li key={name}>
                <span className="cdu-swatch" style={{ background: c }} /> {name} <strong>{v.toFixed(1)}%</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="cdu-card">
          <h3>The drums</h3>
          <CurveChart
            label="Drum fill against hours on line"
            x={{ min: 0, max: COKER_LIMITS.cycle.max, label: 'hours filling', step: 1 }}
            y={{ min: 0, max: 130, label: '% of usable height' }}
            curves={[{ name: 'Coke height in the drum', colour: '#b0b0b0', points: fillCurve }]}
            lines={[
              { y: 100, label: 'foam-over' },
              { x: COKER_LIMITS.decoke, label: 'decoke time' },
            ]}
            marker={{ x: plant.coker.cycle, y: coker.fill * 100 }}
            onPick={(cycle) => controls.setCoker({ cycle: Math.max(COKER_LIMITS.cycle.min, cycle) })}
          />
          <dl className="cdu-readings">
            <dt>Feed</dt>
            <dd>{coker.feed.toFixed(1)} kb/d <small className="muted">(design {COKER_LIMITS.capacity})</small></dd>
            <dt>Fill at the switch</dt>
            <dd className={coker.fill > 1 ? 'cdu-bad' : coker.fill > 0.9 ? '' : 'cdu-good'}>{(coker.fill * 100).toFixed(0)}%</dd>
            <dt>Coke</dt>
            <dd>
              {coker.rates.coke.toFixed(0)} t/d, {coker.grade === 'anode' ? 'anode grade' : 'fuel grade'} <small className="muted">({coker.cokeSulphur.toFixed(1)}% S, ${SITE_PRICES.coke[coker.grade]}/t)</small>
            </dd>
            <dt>Volatile matter</dt>
            <dd className={coker.vcm > 12 ? 'cdu-bad' : ''}>{coker.vcm.toFixed(1)}%</dd>
            <dt>Gas oil, naphtha</dt>
            <dd>
              {coker.rates.gasOil.toFixed(1)}, {coker.rates.naphtha.toFixed(1)} kb/d
            </dd>
          </dl>
          <h3>Warnings</h3>
          <Warnings warnings={plant.coker.running ? coker.warnings : []} quiet={plant.coker.running ? 'Nothing to report.' : 'The coker is shut down.'} onReset={controls.resetHeavyEnd} resetLabel="Shut all three units down" />
        </section>
      </div>
    </>
  )
}

function CokerPfd({ plant, result, cycle }: { plant: Plant; result: TreatingResult; cycle: ReturnType<typeof drumCycle> }) {
  const { coker } = result.conversion
  const on = plant.coker.running
  const drum = (id: 'A' | 'B', x: number) => {
    const filling = on && cycle.filling === id
    const level = filling ? Math.min(1, coker.fill * cycle.through) : 0
    return (
      <g key={id}>
        <g className="pfd-equip">
          <rect x={x} y={70} width={70} height={220} rx={20} />
          <path d={`M${x + 18} 290 L${x + 35} 318 L${x + 52} 290`} />
        </g>
        <rect x={x + 4} y={286 - 212 * level} width={62} height={212 * level} rx={6} fill="#4a4a4a" opacity={0.9} />
        {filling && level > 0 && <rect x={x + 4} y={276 - 212 * level} width={62} height={10} fill="#8a7a5a" opacity={0.6} className="hc-foam" />}
        <text x={x + 35} y={58} className="pfd-label">
          Drum {id}
        </text>
        <text x={x + 35} y={338} className="pfd-note">
          {!on ? 'idle' : filling ? `filling ${(level * 100).toFixed(0)}%` : cycle.idle}
        </text>
        {on && !filling && cycle.idle.startsWith('cutting') && (
          <path className="pfd-line pfd-flow" d={`M${x + 35} 40 V${80 + 180 * cycle.through}`} style={{ stroke: '#7fc8f8', strokeWidth: 3 }} />
        )}
      </g>
    )
  }
  return (
    <svg textAnchor="middle" className="pfd" viewBox="0 0 960 360" role="img" aria-label="Process flow diagram of the delayed coker">
      <defs>
        <marker id="ck-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="rgba(244,234,216,0.6)" />
        </marker>
      </defs>
      <text x={12} y={176} className="pfd-note" textAnchor="start">
        vacuum residue
      </text>
      <text x={12} y={190} className="pfd-note" textAnchor="start">
        {result.conversion.vdu.residueRate.toFixed(1)} kb/d
      </text>
      <path className={`pfd-line${on ? ' pfd-flow' : ' pfd-dry'}`} d="M12 200 H120" style={{ stroke: '#5a4632' }} markerEnd="url(#ck-arrow)" />
      <g className="pfd-equip">
        <rect x={120} y={160} width={70} height={110} rx={4} />
        <text x={155} y={288} className="pfd-label">
          Heater
        </text>
      </g>
      <Tag x={155} y={130} tag="TIC-1201" value={`${plant.coker.heater.toFixed(0)} °C`} alarm={plant.coker.heater > 505} />
      <path className={`pfd-line pfd-hot${on ? ' pfd-flow' : ' pfd-dry'}`} d={`M190 215 H240 V330 H${cycle.filling === 'A' ? 285 : 405} V318`} markerEnd="url(#ck-arrow)" />
      {drum('A', 250)}
      {drum('B', 370)}
      <path className={`pfd-line${on ? ' pfd-flow' : ' pfd-dry'}`} d={`M${cycle.filling === 'A' ? 285 : 405} 70 V36 H560 V80`} markerEnd="url(#ck-arrow)" />
      <Tag x={500} y={70} tag="PIC-1202 drums" value={`${plant.coker.pressure.toFixed(1)} barg`} />
      <g className="pfd-equip">
        <rect x={540} y={80} width={40} height={220} rx={18} />
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} className="pfd-tray" d={`M${i % 2 ? 548 : 544} ${104 + i * 24} h28`} />
        ))}
        <text x={560} y={318} className="pfd-label">
          Fractionator
        </text>
      </g>
      {(
        [
          ['Gas and LPG', 100, '#9fd0e0', `${coker.rates.lpg.toFixed(1)} kb/d LPG`],
          ['Coker naphtha', 160, '#e8e2a8', `${coker.rates.naphtha.toFixed(1)} kb/d`],
          ['Coker gas oil', 220, '#d9733c', `${coker.rates.gasOil.toFixed(1)} kb/d → ${plant.hydrocracker.running ? 'hydrocracker' : 'fuel oil'}`],
        ] as const
      ).map(([name, y, c, v]) => (
        <g key={name}>
          <path className={`pfd-line${on ? ' pfd-flow' : ' pfd-dry'}`} d={`M580 ${y} H700`} style={{ stroke: c }} markerEnd="url(#ck-arrow)" />
          <text x={708} y={y - 2} className="pfd-product" style={{ textAnchor: 'start' }}>
            {name}
          </text>
          <text x={708} y={y + 12} className="pfd-note" textAnchor="start">
            {on ? v : '–'}
          </text>
        </g>
      ))}
      <g className="pfd-equip">
        <rect x={250} y={344} width={190} height={12} rx={2} />
      </g>
      <text x={460} y={354} className="pfd-note" textAnchor="start">
        coke pit: {on ? `${coker.rates.coke.toFixed(0)} t/d, ${coker.grade} grade` : 'empty'}
      </text>
      <text x={940} y={300} className="pfd-note" textAnchor="end">
        drum switch every {plant.coker.cycle} h · {on ? `${((1 - cycle.through) * plant.coker.cycle).toFixed(1)} h to the next` : 'not running'}
      </text>
    </svg>
  )
}

/* ---------------- Hydrocracker ---------------- */

function Hydrocracker({ plant, result }: { plant: Plant; result: TreatingResult }) {
  const { hc, vdu, coker, vgoSulphur } = result.conversion
  const h = plant.hydrocracker
  const on = h.running
  const temps = Array.from({ length: 33 }, (_, i) => HC_LIMITS.temp.min + (i / 32) * (HC_LIMITS.temp.max - HC_LIMITS.temp.min))
  const sweep = temps.map((t) => runHydrocracker(Math.max(h.feed, 10), on && plant.coker.running ? coker.rates.gasOil : 0, vgoSulphur, { ...h, temp: t }))
  const middle = (r: (typeof sweep)[number]) => ((r.rates.jet + r.rates.diesel) / Math.max(0.01, r.freshFeed)) * 100
  const products = [
    ['LPG', hc.rates.lpg, '#9fd0e0'],
    ['Naphtha', hc.rates.naphtha, '#e8e2a8'],
    ['Jet', hc.rates.jet, '#f0a64a'],
    ['Diesel', hc.rates.diesel, '#e8b070'],
    ['Unconverted', hc.rates.unconverted, '#8a6a3a'],
  ] as const
  return (
    <>
      <svg textAnchor="middle" className="pfd" viewBox="0 0 960 300" role="img" aria-label="Process flow diagram of the hydrocracker">
        <defs>
          <marker id="hc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="rgba(244,234,216,0.6)" />
          </marker>
        </defs>
        <text x={12} y={142} className="pfd-note" textAnchor="start">
          gas oil {on ? h.feed.toFixed(1) : '0'} kb/d{plant.coker.running && on ? ` + coker ${coker.rates.gasOil.toFixed(1)}` : ''}
        </text>
        <path className={`pfd-line${on ? ' pfd-flow' : ' pfd-dry'}`} d="M12 150 H150" style={{ stroke: '#8a6a3a' }} markerEnd="url(#hc-arrow)" />
        <path className={`pfd-line${on ? ' pfd-flow' : ' pfd-dry'}`} d="M360 40 H130 V150" style={{ stroke: '#a9c9e8' }} />
        <text x={250} y={32} className="pfd-note">
          hydrogen {hc.hydrogen.toFixed(0)} t/d ({hc.hydrogenPct.toFixed(1)} wt%)
        </text>
        <g className="pfd-equip">
          <rect x={150} y={120} width={60} height={70} rx={4} />
          <text x={180} y={206} className="pfd-label">
            Heater
          </text>
        </g>
        <path className={`pfd-line pfd-hot${on ? ' pfd-flow' : ' pfd-dry'}`} d="M210 150 H240 V60 H262" markerEnd="url(#hc-arrow)" />
        {[262, 330].map((x, i) => (
          <g key={x} className="pfd-equip">
            <rect x={x} y={50} width={44} height={190} rx={20} />
            {[0, 1, 2].map((b) => (
              <rect key={b} x={x + 6} y={70 + b * 55} width={32} height={40} className="pfd-packing" />
            ))}
            <text x={x + 22} y={256} className="pfd-label">
              {i === 0 ? 'Treating' : 'Cracking'}
            </text>
          </g>
        ))}
        <path className={`pfd-line${on ? ' pfd-flow' : ' pfd-dry'}`} d="M306 230 V250 H318 V60 H330" markerEnd="url(#hc-arrow)" />
        <Tag x={352} y={280} tag="TIC-1302 beds" value={`${h.temp.toFixed(0)} °C`} alarm={h.temp > HC_LIMITS.endOfRun} />
        <Tag x={210} y={250} tag="PIC-1301" value={`${h.pressure.toFixed(0)} bar`} />
        <path className={`pfd-line${on ? ' pfd-flow' : ' pfd-dry'}`} d="M374 230 V260 H430 V200" markerEnd="url(#hc-arrow)" />
        <g className="pfd-equip">
          <rect x={410} y={160} width={60} height={40} rx={18} />
          <text x={440} y={150} className="pfd-label">
            HP separator
          </text>
        </g>
        <path className={`pfd-line${on ? ' pfd-flow' : ' pfd-dry'}`} d="M440 160 V40 H360" style={{ stroke: '#a9c9e8' }} markerEnd="url(#hc-arrow)" />
        <text x={448} y={110} className="pfd-note" textAnchor="start">
          recycle gas
        </text>
        <path className={`pfd-line${on ? ' pfd-flow' : ' pfd-dry'}`} d="M470 180 H560" markerEnd="url(#hc-arrow)" />
        <g className="pfd-equip">
          <rect x={560} y={50} width={40} height={220} rx={18} />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} className="pfd-tray" d={`M${i % 2 ? 568 : 564} ${74 + i * 24} h28`} />
          ))}
          <text x={580} y={288} className="pfd-label">
            Fractionator
          </text>
        </g>
        {products.map(([name, v, c], i) => (
          <g key={name}>
            <path className={`pfd-line${on ? ' pfd-flow' : ' pfd-dry'}`} d={`M600 ${70 + i * 46} H720`} style={{ stroke: c }} markerEnd="url(#hc-arrow)" />
            <text x={728} y={68 + i * 46} className="pfd-product" style={{ textAnchor: 'start' }}>
              {name}
            </text>
            <text x={728} y={82 + i * 46} className="pfd-note" textAnchor="start">
              {on ? `${v.toFixed(1)} kb/d` : '–'}
              {name === 'Unconverted' && on ? (h.recycle ? ' (bleed)' : ' → gas oil tank') : ''}
            </text>
          </g>
        ))}
        {h.recycle && on && <path className="pfd-line pfd-flow" d="M580 270 V292 H140 V170 H150" style={{ stroke: '#8a6a3a' }} markerEnd="url(#hc-arrow)" />}
      </svg>
      <div className="cdu-grid">
        <section className="cdu-card">
          <h3>Hydrocracker</h3>
          <p className="cdu-note">
            Gas oil cracked over a zeolite and nickel–tungsten catalyst at {h.pressure.toFixed(0)} bar of hydrogen: jet and diesel with almost no sulphur or aromatics.
            The vacuum unit makes {vdu.vgoRate.toFixed(1)} kb/d of gas oil; the cat cracker takes {plant.fcc.feed.toFixed(1)}.
          </p>
          <RunSwitch label="Unit" running={on} onChange={(running) => controls.setHydrocracker({ running, feed: running && h.feed === 0 ? 10 : h.feed })} />
          <Slider label="Fresh gas oil" value={h.feed} min={HC_LIMITS.feed.min} max={HC_LIMITS.feed.max} step={0.5} digits={1} unit="kb/d" onChange={(feed) => controls.setHydrocracker({ feed })} />
          <Slider label="Bed temperature" value={h.temp} min={HC_LIMITS.temp.min} max={HC_LIMITS.temp.max} step={1} unit="°C" onChange={(temp) => controls.setHydrocracker({ temp })} />
          <Slider label="Pressure" value={h.pressure} min={HC_LIMITS.pressure.min} max={HC_LIMITS.pressure.max} step={5} unit="bar" onChange={(pressure) => controls.setHydrocracker({ pressure })} />
          <div className="cdu-row">
            <span>Unconverted oil</span>
            <div className="segmented">
              <button className="button" aria-pressed={!h.recycle} onClick={() => controls.setHydrocracker({ recycle: false })}>
                Once through
              </button>
              <button className="button" aria-pressed={h.recycle} onClick={() => controls.setHydrocracker({ recycle: true })}>
                Recycle
              </button>
            </div>
          </div>
          <div className="cdu-row">
            <span>Fractionator</span>
            <div className="segmented">
              <button className="button" aria-pressed={h.mode === 'diesel'} onClick={() => controls.setHydrocracker({ mode: 'diesel' })}>
                Max diesel
              </button>
              <button className="button" aria-pressed={h.mode === 'naphtha'} onClick={() => controls.setHydrocracker({ mode: 'naphtha' })}>
                Max naphtha
              </button>
            </div>
          </div>
        </section>
        <section className="cdu-card">
          <CurveChart
            label="Conversion and middle distillate yield against bed temperature"
            x={{ min: HC_LIMITS.temp.min, max: HC_LIMITS.temp.max, label: 'bed temperature, °C' }}
            y={{ min: 0, max: 100, label: '% of fresh feed' }}
            curves={[
              { name: 'Conversion', colour: '#a9c9e8', points: sweep.map((r, i) => [temps[i], r.conversion]) },
              { name: 'Jet and diesel', colour: '#e8b070', points: sweep.map((r, i) => [temps[i], middle(r)]) },
            ]}
            lines={[{ x: HC_LIMITS.endOfRun, label: 'end of run' }]}
            marker={{ x: h.temp, y: hc.conversion }}
            onPick={(temp) => controls.setHydrocracker({ temp })}
          />
          <dl className="cdu-readings">
            <dt>Conversion</dt>
            <dd>
              {hc.conversion.toFixed(1)}% <small className="muted">({hc.perPass.toFixed(0)}% per pass)</small>
            </dd>
            <dt>Reactor charge</dt>
            <dd className={hc.charge > HC_LIMITS.capacity ? 'cdu-bad' : ''}>
              {hc.charge.toFixed(1)} kb/d <small className="muted">(capacity {HC_LIMITS.capacity})</small>
            </dd>
            <dt>Diesel cetane</dt>
            <dd>{hc.dieselCetane.toFixed(0)}</dd>
            <dt>Hydrogen</dt>
            <dd>
              {hc.hydrogen.toFixed(0)} t/d{' '}
              <small className="muted">
                (header: {result.hydrogen.imported > 0 ? `${result.hydrogen.imported.toFixed(0)} t/d bought in` : 'balanced'})
              </small>
            </dd>
          </dl>
          <Warnings warnings={on ? hc.warnings : []} quiet={on ? 'Nothing to report.' : 'The hydrocracker is shut down.'} onReset={controls.resetHeavyEnd} resetLabel="Shut all three units down" />
        </section>
      </div>
    </>
  )
}

/* ---------------- Hydrogen plant ---------------- */

function Smr({ plant, result }: { plant: Plant; result: TreatingResult }) {
  const { smr, hydrogen, reforming } = result
  const s = plant.smr
  const temps = Array.from({ length: 29 }, (_, i) => SMR_LIMITS.outlet.min + (i / 28) * (SMR_LIMITS.outlet.max - SMR_LIMITS.outlet.min))
  const slip = (sc: number) => temps.map((t) => [t, reformerEquilibrium(t, sc).slip] as [number, number])
  const costPerTonne = smr.hydrogen > 0 ? (smr.gas * SITE_PRICES.fuel) / smr.hydrogen : 0
  const glow = Math.min(1, Math.max(0.2, (s.outlet - 760) / 160))
  return (
    <>
      <svg textAnchor="middle" className="pfd" viewBox="0 0 960 280" role="img" aria-label="Process flow diagram of the steam methane reformer">
        <defs>
          <marker id="smr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="rgba(244,234,216,0.6)" />
          </marker>
          <linearGradient id="smr-glow" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff8a2a" stopOpacity={s.running ? glow * 0.7 : 0} />
            <stop offset="1" stopColor="#c2310f" stopOpacity={0} />
          </linearGradient>
        </defs>
        <text x={12} y={122} className="pfd-note" textAnchor="start">
          natural gas + steam (S/C {s.steamCarbon.toFixed(1)})
        </text>
        <path className={`pfd-line${s.running ? ' pfd-flow' : ' pfd-dry'}`} d="M12 130 H130 V60 H180" markerEnd="url(#smr-arrow)" />
        <g className="pfd-equip">
          <rect x={180} y={40} width={200} height={190} rx={4} />
        </g>
        <rect x={184} y={44} width={192} height={182} fill="url(#smr-glow)" />
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1={200 + i * 24} x2={200 + i * 24} y1={52} y2={220} className="pfd-line" style={{ stroke: s.running && s.outlet > SMR_LIMITS.tubeLimit ? '#ff8a6a' : '#c9cdd1', strokeWidth: 4 }} />
        ))}
        <text x={280} y={248} className="pfd-label">
          Reformer furnace (nickel catalyst in the tubes)
        </text>
        <Tag x={430} y={60} tag="TI-1401 outlet" value={`${s.outlet.toFixed(0)} °C`} alarm={s.outlet > SMR_LIMITS.tubeLimit} />
        <path className={`pfd-line pfd-hot${s.running ? ' pfd-flow' : ' pfd-dry'}`} d="M380 200 H470" markerEnd="url(#smr-arrow)" />
        <g className="pfd-equip">
          <rect x={470} y={160} width={50} height={80} rx={14} />
          <text x={495} y={256} className="pfd-label">
            Shift
          </text>
        </g>
        <path className={`pfd-line${s.running ? ' pfd-flow' : ' pfd-dry'}`} d="M520 200 H600" markerEnd="url(#smr-arrow)" />
        <g className="pfd-equip">
          {[600, 640, 680].map((x) => (
            <rect key={x} x={x} y={150} width={30} height={90} rx={10} />
          ))}
          <text x={655} y={256} className="pfd-label">
            PSA
          </text>
        </g>
        <path className={`pfd-line${s.running ? ' pfd-flow' : ' pfd-dry'}`} d="M710 180 H820" style={{ stroke: '#a9c9e8' }} markerEnd="url(#smr-arrow)" />
        <text x={826} y={176} className="pfd-product" style={{ textAnchor: 'start' }}>
          Hydrogen
        </text>
        <text x={826} y={190} className="pfd-note" textAnchor="start">
          {smr.hydrogen.toFixed(0)} t/d, 99.9%
        </text>
        <path className={`pfd-line${s.running ? ' pfd-flow' : ' pfd-dry'}`} d="M655 150 V20 H280 V40" style={{ stroke: '#d4c24a' }} markerEnd="url(#smr-arrow)" />
        <text x={470} y={14} className="pfd-note">
          tail gas burned in the furnace
        </text>
        <text x={940} y={60} className="pfd-note" textAnchor="end">
          CO₂ {smr.co2.toFixed(0)} t/d up the stack
        </text>
      </svg>
      <div className="cdu-grid">
        <section className="cdu-card">
          <h3>Steam methane reformer</h3>
          <p className="cdu-note">
            Natural gas and steam react in tubes of nickel catalyst inside a furnace: CH₄ + H₂O → CO + 3H₂, then CO + H₂O → CO₂ + H₂ in the shift reactor.
            A pressure swing adsorption unit takes out pure hydrogen. It follows the header: the reformer makes {reforming.reformer.hydrogen.toFixed(0)} t/d and the
            users need {hydrogen.demand.toFixed(0)}.
          </p>
          <RunSwitch label="Unit" running={s.running} onChange={(running) => controls.setSmr({ running })} />
          <Slider label="Tube outlet" value={s.outlet} min={SMR_LIMITS.outlet.min} max={SMR_LIMITS.outlet.max} step={5} unit="°C" onChange={(outlet) => controls.setSmr({ outlet })} />
          <Slider label="Steam to carbon" value={s.steamCarbon} min={SMR_LIMITS.steamCarbon.min} max={SMR_LIMITS.steamCarbon.max} step={0.1} digits={1} unit="" onChange={(steamCarbon) => controls.setSmr({ steamCarbon })} />
          <dl className="cdu-readings">
            <dt>Hydrogen made</dt>
            <dd>
              {smr.hydrogen.toFixed(1)} t/d <small className="muted">(capacity {SMR_LIMITS.capacity})</small>
            </dd>
            <dt>Still bought in</dt>
            <dd className={hydrogen.imported > 0 ? 'cdu-bad' : 'cdu-good'}>{hydrogen.imported.toFixed(1)} t/d</dd>
            <dt>Methane converted</dt>
            <dd>
              {smr.conversion.toFixed(1)}% <small className="muted">(slip {smr.slip.toFixed(1)} mol% dry)</small>
            </dd>
            <dt>Natural gas</dt>
            <dd className={smr.gasPerKg > 160 ? '' : 'cdu-good'}>{smr.hydrogen > 0 ? `${smr.gasPerKg.toFixed(0)} MJ per kg of hydrogen` : '–'}</dd>
            <dt>Cost</dt>
            <dd>
              {smr.hydrogen > 0 ? `$${costPerTonne.toFixed(0)}/t of gas` : '–'} <small className="muted">(bought: ${SITE_PRICES.hydrogen}/t)</small>
            </dd>
            <dt>CO₂</dt>
            <dd>{smr.hydrogen > 0 ? `${(smr.co2 / smr.hydrogen).toFixed(1)} t per t of hydrogen` : '–'}</dd>
          </dl>
        </section>
        <section className="cdu-card">
          <CurveChart
            label="Methane slip at equilibrium against tube outlet temperature"
            x={{ min: SMR_LIMITS.outlet.min, max: SMR_LIMITS.outlet.max, label: 'tube outlet, °C', step: 5 }}
            y={{ min: 0, max: 14, label: 'methane slip, mol% dry' }}
            curves={[
              { name: `S/C ${s.steamCarbon.toFixed(1)}`, colour: '#f0a64a', points: slip(s.steamCarbon) },
              { name: 'S/C 2.5', colour: '#a9c9e8', dashed: true, points: slip(2.5) },
              { name: 'S/C 4', colour: '#8fe3a4', dashed: true, points: slip(4) },
            ]}
            lines={[{ x: SMR_LIMITS.tubeLimit, label: 'tube limit' }]}
            marker={{ x: s.outlet, y: smr.slip }}
            onPick={(outlet) => controls.setSmr({ outlet })}
          />
          <Warnings warnings={s.running ? smr.warnings : []} quiet={s.running ? 'Nothing to report.' : 'The hydrogen plant is shut down: hydrogen the reformer can’t make is bought in.'} onReset={controls.resetHeavyEnd} resetLabel="Shut all three units down" />
        </section>
      </div>
    </>
  )
}

function Learn() {
  return (
    <div className="cdu-learn">
      <h3>The bottom of the barrel</h3>
      <p>
        Vacuum residue is what's left when everything that will boil has been boiled off: thick, black, full of carbon, sulphur and metals,
        and worth less than the crude it came from. Selling it as fuel oil loses money on every barrel. Conversion units turn it into
        lighter products, by taking carbon out (coking) or putting hydrogen in (hydrocracking).
      </p>
      <h3>The delayed coker</h3>
      <p>
        The residue is heated fast to about 495 °C in a furnace and dropped into a tall drum, where it has time (the "delay") to crack. The
        lighter part leaves as vapour for a fractionator; the heaviest polymerises into solid coke that fills the drum. After about 18 hours
        the feed switches to the second drum, and the full one is steamed, quenched with water, opened, and cut out by high-pressure water
        jets from a drill lowered through the top. Coke from sweet crude goes to make anodes for aluminium smelters; sour coke is fuel.
        Coke yield is about 1.6 times the feed's Conradson carbon.
      </p>
      <h3>The hydrocracker</h3>
      <p>
        At 100–180 bar of hydrogen and around 400 °C, a first reactor strips out sulphur and nitrogen, and a second cracks the gas oil over
        a zeolite. The hydrogen saturates everything it breaks, so the products are clean: jet and diesel with high cetane and almost no
        sulphur or aromatics. Pushing each pass harder makes more naphtha and gas, so many units crack part of the feed each pass and send
        the rest round again "to extinction". It needs 2–3% of its feed's weight in hydrogen, far more than the reformer makes.
      </p>
      <h3>Making hydrogen</h3>
      <p>
        A steam methane reformer makes it from natural gas. Reforming is strongly endothermic and equilibrium-limited, so it needs hot tubes
        (850–900 °C) and plenty of steam; the tubes creep at those temperatures and are the plant's life limit. Each tonne of hydrogen
        takes about 160 GJ of gas and releases about 9 tonnes of CO₂, which is why refineries are looking at capturing it, or making
        hydrogen by electrolysis instead.
      </p>
      <h3>About this model</h3>
      <p className="muted">
        Coker yields use Gary and Handwerk's correlations on Conradson carbon, with pressure, recycle and heater effects. The hydrocracker is
        first-order cracking with an Arrhenius rate, a selectivity that falls with conversion per pass, and lumped hydrogen use. The hydrogen
        plant solves the reforming and shift equilibria at 25 bar with standard equilibrium constants, then a shift reactor and a PSA
        recovering 89%. Typical, not a design tool.
      </p>
    </div>
  )
}
