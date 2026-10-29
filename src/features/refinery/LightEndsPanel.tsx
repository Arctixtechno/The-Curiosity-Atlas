import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { complete } from './challenges.ts'
import { CRUDES } from './crudes.ts'
import { GasPlantIcon } from './icons.tsx'
import { ALKY_LIMITS, GAS_PLANT_LIMITS, ISOM_LIMITS, isoOctane, runAlky, runGasPlant, runIsom } from './lightEnds.ts'
import { LightEndsPfd } from './LightEndsPfd.tsx'
import { lightEndsResult, lpgTotal, type LightEndsResult } from './lightEndsPlant.ts'
import { LIGHT_ENDS_TASKS } from './lightEndsTasks.ts'
import { controls, usePlant, type Plant } from './plant.ts'
import { CurveChart, ScreenTabs, Slider, TaskList, Warnings, type ScreenTab } from './ui.tsx'
import { usePlantClock } from './clock.ts'
import './Refinery.css'

/** The gas plant, isomerisation and alkylation: turning the refinery's gas and lightest naphtha into octane. */
export function LightEndsPanel() {
  usePlantClock()
  const plant = usePlant((p) => p)
  const result = useMemo(() => lightEndsResult(plant), [plant])
  const [tab, setTab] = useState<ScreenTab>('operate')

  useEffect(() => {
    for (const t of LIGHT_ENDS_TASKS) if (t.met(plant, result)) complete(t.id)
  }, [plant, result])

  return (
    <Panel
      title="Light ends: gas plant, isomerisation and alkylation"
      subtitle="Units 800 to 1000 at Marshgate: propane, butane and the cleanest octane in the pool"
      icon={<GasPlantIcon />}
      wide
    >
      <div className="cdu">
        <ScreenTabs
          tab={tab}
          onChange={setTab}
          aside={
            <span className="muted">
              Gas from the crude unit, cat cracker and reformer: {CRUDES[plant.furnace.crude].name} at {plant.furnace.feed.toFixed(0)} kb/d
            </span>
          }
        />
        <LightEndsPfd plant={plant} result={result} />
        {tab === 'operate' && <Operate plant={plant} result={result} />}
        {tab === 'shift' && (
          <TaskList
            intro="Requests from the planners and the alkylation supervisor. Each is done as soon as you meet it, and progress is saved in this browser."
            tasks={LIGHT_ENDS_TASKS}
            plant={plant}
            result={result}
          />
        )}
        {tab === 'learn' && <Learn />}
      </div>
    </Panel>
  )
}

const range = (min: number, max: number, n = 48) => Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n)

function Operate({ plant, result }: { plant: Plant; result: LightEndsResult }) {
  const { gasPlant, isom, alky } = result
  const warnings = [...gasPlant.warnings, ...(plant.isom.running ? isom.warnings : []), ...alky.warnings]

  // Sweep each unit's main setting to draw the curve the operator is moving along.
  const refluxCurve = useMemo(
    () => range(GAS_PLANT_LIMITS.reflux.min, GAS_PLANT_LIMITS.reflux.max).map((r) => [r, runGasPlant(gasPlant.feed, { reflux: r }).butaneInPropane] as [number, number]),
    [gasPlant.feed],
  )
  const dutyCurve = useMemo(
    () => range(GAS_PLANT_LIMITS.reflux.min, GAS_PLANT_LIMITS.reflux.max).map((r) => [r, runGasPlant(gasPlant.feed, { reflux: r }).duty] as [number, number]),
    [gasPlant.feed],
  )
  const temps = range(ISOM_LIMITS.temp.min, ISOM_LIMITS.temp.max)
  const isomCurves = [
    { name: 'Equilibrium', colour: '#a9c9e8', dashed: true, points: temps.map((t) => [t, isoOctane(runIsom(1, { temp: t, recycle: false, running: true }).equilibrium)] as [number, number]) },
    { name: 'Once through', colour: '#e8e2a8', points: temps.map((t) => [t, runIsom(1, { temp: t, recycle: false, running: true }).octane] as [number, number]) },
    { name: 'With recycle', colour: '#b8e08a', points: temps.map((t) => [t, runIsom(1, { temp: t, recycle: true, running: true }).octane] as [number, number]) },
  ]
  const alkyTemps = range(ALKY_LIMITS.temp.min, ALKY_LIMITS.temp.max, 28)
  const alkyCurves = [
    { name: 'Octane', colour: '#d6e8f0', points: alkyTemps.map((t) => [t, runAlky(gasPlant.bottoms, gasPlant.overhead, { ...plant.alky, temp: t }).octane] as [number, number]) },
  ]

  const isobutaneScale = Math.max(alky.isobutaneAvailable, alky.isobutaneUsed) || 1
  return (
    <div className="cdu-grid">
      <section className="cdu-card">
        <h3>Depropaniser</h3>
        <p className="cdu-note">
          {lpgTotal(gasPlant.feed).toFixed(1)} kb/d of LPG, {(gasPlant.lightShare * 100).toFixed(0)}% propane and propylene, split into
          propane for sale and butanes for alkylation. Minimum reflux is {gasPlant.minReflux.toFixed(2)}; below it no column could make the split.
        </p>
        <Slider
          label="Reflux ratio"
          value={plant.gasPlant.reflux}
          min={GAS_PLANT_LIMITS.reflux.min}
          max={GAS_PLANT_LIMITS.reflux.max}
          step={0.05}
          digits={2}
          unit=""
          onChange={(reflux) => controls.setGasPlant({ reflux })}
        />
        <CurveChart
          label="Butane left in the propane against reflux ratio"
          x={{ min: GAS_PLANT_LIMITS.reflux.min, max: GAS_PLANT_LIMITS.reflux.max, label: 'reflux ratio', step: 0.05 }}
          y={{ min: 0, max: 10, label: 'C₄ in propane, %' }}
          curves={[{ name: 'Butane in the propane', colour: '#9fd0e0', points: refluxCurve }]}
          lines={[
            { x: gasPlant.minReflux, label: 'R min' },
            { y: GAS_PLANT_LIMITS.butaneInPropaneMax, label: 'spec' },
          ]}
          marker={{ x: plant.gasPlant.reflux, y: gasPlant.butaneInPropane }}
          onPick={(reflux) => controls.setGasPlant({ reflux })}
        />
        <CurveChart
          label="Reboiler duty against reflux ratio"
          x={{ min: GAS_PLANT_LIMITS.reflux.min, max: GAS_PLANT_LIMITS.reflux.max, label: 'reflux ratio', step: 0.05 }}
          y={{ min: 0, max: Math.ceil(dutyCurve[dutyCurve.length - 1][1] + 1), label: 'reboiler, MW' }}
          curves={[{ name: 'Reboiler duty', colour: '#f0a64a', points: dutyCurve }]}
          marker={{ x: plant.gasPlant.reflux, y: gasPlant.duty }}
          onPick={(reflux) => controls.setGasPlant({ reflux })}
        />
        <dl className="cdu-readings">
          <dt>Trays the separation needs at least</dt>
          <dd>{gasPlant.minStages.toFixed(1)} of {GAS_PLANT_LIMITS.stages}</dd>
          <dt>Butane in propane</dt>
          <dd className={gasPlant.butaneInPropane > GAS_PLANT_LIMITS.butaneInPropaneMax ? 'cdu-bad' : 'cdu-good'}>
            {gasPlant.butaneInPropane.toFixed(2)}% <small className="muted">(limit {GAS_PLANT_LIMITS.butaneInPropaneMax})</small>
          </dd>
          <dt>Reboiler</dt>
          <dd>{gasPlant.duty.toFixed(2)} MW</dd>
        </dl>
      </section>

      <section className="cdu-card">
        <h3>Isomerisation</h3>
        <p className="cdu-note">
          {result.lightNaphtha.toFixed(1)} kb/d of light naphtha at {isom.feedOctane.toFixed(0)} octane. A platinum catalyst rearranges
          its straight-chain pentanes and hexanes into branched ones, which knock far less.
        </p>
        <div className="cdu-row">
          <span>Unit</span>
          <div className="segmented">
            <button className="button" aria-pressed={!plant.isom.running} onClick={() => controls.setIsom({ running: false })}>
              Bypassed
            </button>
            <button className="button" aria-pressed={plant.isom.running} onClick={() => controls.setIsom({ running: true })}>
              Running
            </button>
          </div>
        </div>
        <Slider
          label="Reactor temperature"
          value={plant.isom.temp}
          min={ISOM_LIMITS.temp.min}
          max={ISOM_LIMITS.temp.max}
          step={1}
          unit="°C"
          onChange={(temp) => controls.setIsom({ temp })}
        />
        <div className="cdu-row">
          <span>Deisohexaniser recycle</span>
          <div className="segmented">
            <button className="button" aria-pressed={!plant.isom.recycle} onClick={() => controls.setIsom({ recycle: false })}>
              Once through
            </button>
            <button className="button" aria-pressed={plant.isom.recycle} onClick={() => controls.setIsom({ recycle: true })}>
              Recycle
            </button>
          </div>
        </div>
        <CurveChart
          label="Isomerate octane against reactor temperature"
          x={{ min: ISOM_LIMITS.temp.min, max: ISOM_LIMITS.temp.max, label: 'reactor, °C' }}
          y={{ min: 70, max: 92, label: 'research octane' }}
          curves={isomCurves}
          marker={{ x: plant.isom.temp, y: isom.octane }}
          onPick={(temp) => controls.setIsom({ temp })}
        />
        <dl className="cdu-readings">
          <dt>Branched share</dt>
          <dd>
            {(isom.iso * 100).toFixed(0)}% <small className="muted">(equilibrium {(isom.equilibrium * 100).toFixed(0)}%)</small>
          </dd>
          <dt>Approach to equilibrium</dt>
          <dd>{(isom.approach * 100).toFixed(0)}%</dd>
          <dt>Isomerate</dt>
          <dd className={plant.isom.running ? 'cdu-good' : 'muted'}>
            {plant.isom.running ? `${isom.product.toFixed(1)} kb/d at ${isom.octane.toFixed(1)} RON` : 'Bypassed: light naphtha goes straight to blending'}
          </dd>
        </dl>
      </section>

      <section className="cdu-card">
        <h3>Sulphuric acid alkylation</h3>
        <p className="cdu-note">
          Isobutane joins the cat cracker's butylenes{plant.alky.propylene ? ' and propylene' : ''} in strong acid at a few degrees
          above freezing, making alkylate: branched octanes with no aromatics, olefins or sulphur to speak of.
        </p>
        <Slider label="Isobutane to olefin" value={plant.alky.ratio} min={ALKY_LIMITS.ratio.min} max={ALKY_LIMITS.ratio.max} step={0.5} digits={1} unit=": 1" onChange={(ratio) => controls.setAlky({ ratio })} />
        <Slider label="Reactor temperature" value={plant.alky.temp} min={ALKY_LIMITS.temp.min} max={ALKY_LIMITS.temp.max} step={0.5} digits={1} unit="°C" onChange={(temp) => controls.setAlky({ temp })} />
        <Slider label="Acid strength" value={plant.alky.acid} min={ALKY_LIMITS.acid.min} max={ALKY_LIMITS.acid.max} step={0.5} digits={1} unit="wt%" onChange={(acid) => controls.setAlky({ acid })} />
        <div className="cdu-row">
          <span>Propylene</span>
          <div className="segmented">
            <button className="button" aria-pressed={!plant.alky.propylene} onClick={() => controls.setAlky({ propylene: false })}>
              Sold with propane
            </button>
            <button className="button" aria-pressed={plant.alky.propylene} onClick={() => controls.setAlky({ propylene: true })}>
              Alkylated
            </button>
          </div>
        </div>
        <CurveChart
          label="Alkylate octane against reactor temperature"
          x={{ min: ALKY_LIMITS.temp.min, max: ALKY_LIMITS.temp.max, label: 'reactor, °C', step: 0.5 }}
          y={{ min: 88, max: 99, label: 'research octane' }}
          curves={alkyCurves}
          marker={{ x: plant.alky.temp, y: alky.octane }}
          onPick={(temp) => controls.setAlky({ temp })}
        />
        <div className="cv-heat">
          <div className="cv-heat-row">
            <span>Isobutane made</span>
            <div className="cv-stack">
              <div style={{ width: `${(alky.isobutaneAvailable / isobutaneScale) * 100}%`, background: '#9fd0e0' }} />
            </div>
            <output>{alky.isobutaneAvailable.toFixed(1)} kb/d</output>
          </div>
          <div className="cv-heat-row">
            <span>Isobutane used</span>
            <div className="cv-stack">
              <div style={{ width: `${(alky.isobutaneUsed / isobutaneScale) * 100}%`, background: alky.isobutaneImported > 0 ? '#e07a5f' : '#d6e8f0' }} />
            </div>
            <output>{alky.isobutaneUsed.toFixed(1)} kb/d</output>
          </div>
          {alky.isobutaneImported > 0 && <p className="cdu-note cdu-bad">{alky.isobutaneImported.toFixed(1)} kb/d of isobutane bought in to keep up.</p>}
        </div>
        <dl className="cdu-readings">
          <dt>Alkylate</dt>
          <dd>
            {alky.alkylate.toFixed(2)} kb/d at {alky.octane.toFixed(1)} RON
          </dd>
          <dt>Fresh acid</dt>
          <dd>{alky.acidUse.toFixed(1)} t/d</dd>
          <dt>Refrigeration and compression</dt>
          <dd>{alky.power.toFixed(1)} MW</dd>
        </dl>
      </section>

      <section className="cdu-card">
        <h3>Warnings</h3>
        <Warnings
          warnings={warnings}
          quiet="Nothing to report. The propane is on spec and the acid is strong."
          onReset={controls.resetLightEnds}
          resetLabel="Reset all three units to design"
        />
      </section>
    </div>
  )
}

function Learn() {
  return (
    <div className="cdu-learn">
      <h3>The light ends</h3>
      <p>
        Every unit makes some gas. The lightest (methane, ethane, hydrogen) is burned in the refinery's own furnaces. Propane and the
        butanes are liquefied petroleum gas: worth more as products, and the butylenes and isobutane among them are the raw material
        for the best petrol component a refinery makes. A train of columns called the gas plant sorts them.
      </p>
      <h3>Reflux and minimum reflux</h3>
      <p>
        The depropaniser separates propane from butane, which boil only 40 °C apart at the column's pressure. Liquid poured back down
        from the top (the reflux) washes butane out of the rising vapour on every tray. More reflux means a sharper split, but every
        tonne of it has to be boiled up again by the reboiler at the bottom. Underwood worked out the least reflux at which a split is
        possible at all, with an infinite number of trays; Fenske the fewest trays, at infinite reflux; and Gilliland's correlation
        joins the two for a real column. Operators run just above where the product meets spec, because that's where it costs least.
      </p>
      <h3>Isomerisation</h3>
      <p>
        Light naphtha is mostly pentane and hexane. Their straight-chain forms knock badly (normal hexane rates about 25), the branched
        ones much less (2,2-dimethylbutane about 92). A chlorided platinum catalyst rearranges them, but only up to equilibrium, and
        equilibrium favours the branched isomers at low temperature, where the catalyst is slow. The best once-through octane is where
        the two meet. A deisohexaniser after the reactor sends what stayed straight back for another pass, adding about four numbers.
      </p>
      <h3>Alkylation</h3>
      <p>
        Isobutane and butylene, joined in strong sulphuric acid, make trimethylpentanes: isooctane, the fuel that defines 100 on the
        octane scale. The reaction competes with olefins joining each other into heavy, low-octane polymer. Plenty of isobutane, a cold
        reactor (held at 5–10 °C by evaporating some of the isobutane) and strong acid all tip the balance towards alkylate. The acid is
        slowly diluted by water and polymer, and is replaced continuously; below about 88% it can run away. Propylene can be alkylated
        too, at lower octane and more acid.
      </p>
      <h3>About this model</h3>
      <p className="muted">
        The depropaniser is a binary of the key components with constant relative volatility 2.3: Underwood minimum reflux, Gilliland
        in Eduljee's form and Fenske for the split. Isomerisation is an equilibrium that falls with temperature approached with an
        Arrhenius rate. Alkylate octane and acid use are linear and exponential fits to the ranges in published operating data
        (Gary and Handwerk; Meyers, Handbook of Petroleum Refining Processes). Typical, not a design tool.
      </p>
    </div>
  )
}
