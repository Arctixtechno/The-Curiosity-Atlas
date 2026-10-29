import { useEffect, useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { octaneGiveaway, OFF_SPEC_PRICE, type BlendResult, type Component, type PropertyId, type SpecCheck } from './blending.ts'
import { complete } from './challenges.ts'
import { BlendIcon } from './icons.tsx'
import { lightEndsResult, type Pool } from './lightEndsPlant.ts'
import { BLENDING_TASKS } from './lightEndsTasks.ts'
import { controls, usePlant, type Plant } from './plant.ts'
import { money, ScreenTabs, TaskList, type ScreenTab } from './ui.tsx'
import { usePlantClock } from './clock.ts'
import './Refinery.css'

type PoolId = 'petrol' | 'diesel'

/** The blend headers: every petrol and diesel stream mixed to a recipe, checked against the spec, and sold. */
export function BlendingPanel() {
  usePlantClock()
  const plant = usePlant((p) => p)
  const result = useMemo(() => lightEndsResult(plant), [plant])
  const [tab, setTab] = useState<ScreenTab>('operate')
  const [poolId, setPoolId] = useState<PoolId>('petrol')
  const pool = result[poolId]

  useEffect(() => {
    for (const t of BLENDING_TASKS) if (t.met(plant, result)) complete(t.id)
  }, [plant, result])

  return (
    <Panel title="Blending and the product tanks" subtitle="The blend headers at Marshgate: where streams become petrol and diesel" icon={<BlendIcon />} wide>
      <div className="cdu">
        <ScreenTabs
          tab={tab}
          onChange={setTab}
          aside={
            <div className="segmented" aria-label="Pool">
              {(
                [
                  ['petrol', 'Petrol pool'],
                  ['diesel', 'Diesel pool'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} className="button" aria-pressed={poolId === id} onClick={() => setPoolId(id)}>
                  {label}
                </button>
              ))}
            </div>
          }
        />
        <BlendHeader pool={pool} />
        {tab === 'operate' && <Operate plant={plant} pool={pool} poolId={poolId} />}
        {tab === 'shift' && (
          <TaskList
            intro="Orders from the product planners. Set the recipes yourself: a recipe taken straight from the planner doesn't count. Progress is saved in this browser."
            tasks={BLENDING_TASKS}
            plant={plant}
            result={result}
          />
        )}
        {tab === 'learn' && <Learn />}
      </div>
    </Panel>
  )
}

/* ---------------- The blend header drawing ---------------- */

const HW = 960
const HH = 210

/** Component tanks along the top, run-down lines into the header, and the product tank filling in layers. */
function BlendHeader({ pool }: { pool: Pool }) {
  const { components, volumes, blend, grade } = pool
  const n = components.length
  const span = 600 / n
  const tankX = (i: number) => 30 + span * i + span / 2
  const total = blend.total || 1
  const productTop = 40
  const productH = 140
  let level = productTop + productH
  return (
    <svg textAnchor="middle" className="pfd" viewBox={`0 0 ${HW} ${HH}`} role="img" aria-label={`Blend header for ${grade.name}`}>
      <defs>
        <marker id="bl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="rgba(244,234,216,0.6)" />
        </marker>
      </defs>
      {components.map((c, i) => {
        const x = tankX(i)
        const v = volumes[i]
        const share = c.purchased ? (v > 0 ? 1 : 0) : c.available > 0 ? Math.min(1, v / c.available) : 0
        const h = 56
        return (
          <g key={c.id}>
            <g className="pfd-equip">
              <rect x={x - 22} y={22} width={44} height={h} rx={c.purchased ? 4 : 8} />
            </g>
            <rect x={x - 19} y={22 + 3 + (h - 6) * (1 - share)} width={38} height={(h - 6) * share} rx={5} fill={c.colour} opacity={0.75} />
            <text x={x} y={14} className="pfd-label">
              {c.name.replace(' (bought)', '')}
            </text>
            <text x={x} y={92} className="pfd-note">
              {v.toFixed(1)}
              {c.purchased ? ' bought' : ` / ${c.available.toFixed(1)}`}
            </text>
            <path className={`pfd-line${v > 0.01 ? ' pfd-flow' : ' pfd-dry'}`} d={`M${x} 98 V${150}`} style={{ stroke: c.colour }} />
          </g>
        )
      })}
      <path className={`pfd-line${blend.total > 0 ? ' pfd-flow' : ' pfd-dry'}`} d={`M${tankX(0)} 150 H700`} markerEnd="url(#bl-arrow)" />
      <text x={(tankX(0) + 700) / 2 + 40} y={168} className="pfd-note">
        blend header · in-line analysers
      </text>

      {/* Product tank, layered by component share. */}
      <g className="pfd-equip">
        <rect x={700} y={productTop - 6} width={130} height={productH + 12} rx={8} />
      </g>
      {components.map((c, i) => {
        const h = (volumes[i] / total) * productH
        level -= h
        return h > 0.2 ? <rect key={c.id} x={704} y={level} width={122} height={h} fill={c.colour} opacity={0.8} /> : null
      })}
      <text x={765} y={productTop - 12} className="pfd-label">
        {grade.name}
      </text>
      <text x={765} y={productTop + productH + 24} className="pfd-note">
        {blend.total.toFixed(1)} kb/d
      </text>
      <circle cx={850} cy={productTop + 10} r={7} className={blend.onSpec ? 'pfd-ok' : 'pfd-bad'} />
      <text x={864} y={productTop + 14} className="pfd-note" textAnchor="start" style={blend.onSpec ? undefined : { fill: '#ff8a6a' }}>
        {blend.total === 0 ? 'empty' : blend.onSpec ? 'on spec' : 'off spec'}
      </text>
      <text x={850} y={productTop + 44} className="pfd-note" textAnchor="start">
        {blend.onSpec ? `to the rack at $${grade.price}` : `export at $${OFF_SPEC_PRICE}`}
      </text>
      <text x={850} y={productTop + 58} className="pfd-note" textAnchor="start">
        a barrel
      </text>
      <path className={`pfd-line${blend.total > 0 ? ' pfd-flow' : ' pfd-dry'}`} d={`M830 ${productTop + productH - 10} H940`} markerEnd="url(#bl-arrow)" />
    </svg>
  )
}

/* ---------------- Operate ---------------- */

/** How each property is shown: the bar's range and how many decimals. */
const DISPLAY: Record<PropertyId, { min: number; max: number; digits: number }> = {
  ron: { min: 85, max: 100, digits: 1 },
  mon: { min: 75, max: 92, digits: 1 },
  rvp: { min: 20, max: 110, digits: 1 },
  aromatics: { min: 0, max: 50, digits: 1 },
  olefins: { min: 0, max: 30, digits: 1 },
  benzene: { min: 0, max: 2, digits: 2 },
  sulphur: { min: 0, max: 20, digits: 1 },
  oxygen: { min: 0, max: 6, digits: 2 },
  ethanol: { min: 0, max: 15, digits: 1 },
  cetane: { min: 40, max: 60, digits: 1 },
  density: { min: 790, max: 870, digits: 1 },
  cloud: { min: -25, max: 10, digits: 1 },
  fame: { min: 0, max: 12, digits: 1 },
}

const recipeOf = (pool: Pool) => Object.fromEntries(pool.components.map((c, i) => [c.id, pool.volumes[i]]))

function Operate({ plant, pool, poolId }: { plant: Plant; pool: Pool; poolId: PoolId }) {
  const { components, volumes, blend, best, grade } = pool
  const made = components.reduce((sum, c) => sum + (c.purchased ? 0 : c.available), 0)
  const base = recipeOf(pool)
  const set = (c: Component, v: number) => controls.setRecipe(poolId, c.id, v, base)
  const planned = plant.blend.planned[poolId]
  const giveaway = octaneGiveaway(blend)
  return (
    <div className="cdu-grid">
      <section className="cdu-card">
        <h3>Recipe</h3>
        <div className="cdu-row">
          <span>Season</span>
          <div className="segmented">
            {(['summer', 'winter'] as const).map((s) => (
              <button key={s} className="button" aria-pressed={plant.blend.season === s} onClick={() => controls.setBlend({ season: s })}>
                {s === 'summer' ? 'Summer' : 'Winter'}
              </button>
            ))}
          </div>
        </div>
        {poolId === 'petrol' && (
          <div className="cdu-row">
            <span>Grade</span>
            <div className="segmented">
              {(
                [
                  ['premium', 'Premium 95'],
                  ['super', 'Super 98'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} className="button" aria-pressed={plant.blend.grade === id} onClick={() => controls.setBlend({ grade: id })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {components.map((c, i) => {
          const max = c.purchased ? Math.max(1, made * 0.15) : c.available
          return (
            <label key={c.id} className="cdu-control bl-component">
              <span>
                <span className="cdu-swatch" style={{ background: c.colour }} /> {c.name}
              </span>
              <input type="range" min={0} max={max} step={0.05} value={Math.min(max, volumes[i])} onChange={(e) => set(c, Number(e.target.value))} disabled={max <= 0} />
              <output>
                {volumes[i].toFixed(1)} <small className="muted">{c.purchased ? `$${c.value}` : `of ${c.available.toFixed(1)}`}</small>
              </output>
            </label>
          )
        })}
        <div className="bl-buttons">
          <button className="button" onClick={() => controls.applyRecipe(poolId, recipeOf({ ...pool, volumes: best.volumes }), true)}>
            Use the planner's recipe
          </button>
          <button className="button button-quiet" onClick={() => controls.applyRecipe(poolId, Object.fromEntries(components.map((c) => [c.id, c.purchased ? 0 : c.available])), false)}>
            Everything in
          </button>
          <button className="button button-quiet" onClick={() => controls.applyRecipe(poolId, Object.fromEntries(components.map((c) => [c.id, 0])), false)}>
            Empty
          </button>
        </div>
        {planned && <p className="cdu-note muted">This is the planner's recipe. Move any slider to take it over by hand.</p>}
        <p className="cdu-note muted">
          What isn't blended is sold elsewhere at its own value: butane as LPG, kerosene as jet, the rest as export blendstock.
        </p>
      </section>

      <section className="cdu-card">
        <h3>Against the spec</h3>
        <SpecBars specs={blend.specs} />
        <h3>Money</h3>
        <dl className="cdu-readings">
          <dt>Sold</dt>
          <dd>
            {blend.total.toFixed(1)} kb/d at ${blend.onSpec ? grade.price : OFF_SPEC_PRICE} <small className="muted">{blend.onSpec ? grade.name : 'off spec, as blendstock'}</small>
          </dd>
          <dt>Worth of the components elsewhere</dt>
          <dd>{money(blend.componentValue)} a day</dd>
          <dt>Blending margin</dt>
          <dd className={blend.margin >= 0 ? 'cdu-good' : 'cdu-bad'}>{money(blend.margin)} a day</dd>
          {poolId === 'petrol' && blend.onSpec && (
            <>
              <dt>Octane given away</dt>
              <dd className={giveaway > 0.5 ? 'cdu-bad' : ''}>
                {giveaway.toFixed(2)} <small className="muted">over spec on the tighter of RON and MON</small>
              </dd>
            </>
          )}
        </dl>
        <Comparison pool={pool} best={best} />
      </section>
    </div>
  )
}

/** One bar per property, with its limits marked: two-sided specs (vapour pressure, density) share a bar. */
function SpecBars({ specs }: { specs: SpecCheck[] }) {
  const props = [...new Set(specs.map((s) => s.prop))]
  return (
    <div className="bl-specs">
      {props.map((prop) => {
        const own = specs.filter((s) => s.prop === prop)
        const d = DISPLAY[prop]
        const at = (v: number) => `${Math.min(100, Math.max(0, ((v - d.min) / (d.max - d.min)) * 100))}%`
        const value = own[0].value
        const ok = own.every((s) => s.ok)
        const min = own.find((s) => s.kind === 'min')
        const max = own.find((s) => s.kind === 'max')
        return (
          <div key={prop} className={`cv-gauge bl-spec${ok ? '' : ' cv-gauge-bad'}`} title={own.map((s) => s.why).join(' ')}>
            <span>{own[0].name}</span>
            <div className="cv-gauge-bar">
              {min && <div className="bl-spec-out" style={{ left: 0, width: at(min.limit) }} />}
              {max && <div className="bl-spec-out" style={{ left: at(max.limit), right: 0 }} />}
              <div className="bl-spec-value" style={{ left: at(value) }} />
            </div>
            <output>
              {value.toFixed(d.digits)} {own[0].unit}
              <small className="muted">
                {' '}
                {min && max ? `${min.limit}–${max.limit}` : min ? `≥ ${min.limit}` : `≤ ${max!.limit}`}
              </small>
            </output>
          </div>
        )
      })}
    </div>
  )
}

/** The recipe as set beside the planner's, as two stacked bars, and the margin each earns. */
function Comparison({ pool, best }: { pool: Pool; best: BlendResult }) {
  const scale = Math.max(pool.blend.total, best.total) || 1
  const rows: [string, BlendResult][] = [
    ['Yours', pool.blend],
    ['Planner', best],
  ]
  return (
    <div className="cv-heat">
      {rows.map(([name, b]) => (
        <div key={name} className="cv-heat-row">
          <span>{name}</span>
          <div className="cv-stack">
            {pool.components.map((c, i) => (
              <div key={c.id} style={{ width: `${(b.volumes[i] / scale) * 100}%`, background: c.colour }} title={`${c.name} ${b.volumes[i].toFixed(1)} kb/d`} />
            ))}
          </div>
          <output>{money(b.margin)}</output>
        </div>
      ))}
      <p className="cdu-note">
        {best.total === 0
          ? 'The planner can’t make this grade on spec from what the units make today. Change the units, or the grade.'
          : pool.blend.margin >= best.margin - 500
            ? 'You are matching the planner.'
            : `The planner's recipe earns ${money(best.margin - pool.blend.margin)} a day more.`}
      </p>
    </div>
  )
}

function Learn() {
  return (
    <div className="cdu-learn">
      <h3>No unit makes petrol</h3>
      <p>
        Petrol is a recipe. Reformate brings octane but too many aromatics and benzene; cat gasoline is cheap but carries olefins and
        sulphur; alkylate and isomerate are clean but scarce; butane is cheap octane that boils too easily. Ethanol is bought in and
        is a powerful octane booster. The blender's job is to mix them so that every spec is met at once, and no better than it has to
        be, because every number over spec is value handed to the customer for nothing: "giveaway".
      </p>
      <h3>How properties blend</h3>
      <p>
        Some properties are simple averages by volume: octane, aromatics, olefins, benzene, cetane, density. Sulphur and oxygen are
        averages by mass, because the specs are in parts per million and percent by weight. Vapour pressure and cloud point don't
        average at all. A little butane raises vapour pressure far more than its share, and a little wax raises the cloud point
        of the whole blend, so blenders use blending indices: Chevron's RVP<sup>1.25</sup> for vapour pressure, and an exponential
        index for cloud point, which do average.
      </p>
      <h3>Seasons</h3>
      <p>
        In summer, petrol's vapour pressure is held low so it doesn't evaporate into smog; in winter it is allowed higher, so cold
        engines start, which lets the blender use more cheap butane. Diesel in winter must not grow wax crystals in a cold fuel filter,
        so its cloud point limit drops and kerosene, which has almost no wax, goes into the blend.
      </p>
      <h3>The planner</h3>
      <p>
        Because each spec, written in blending indices, is a straight line in the volumes, finding the most profitable recipe is a
        linear programme: the same mathematics, invented by Kantorovich and Dantzig in the 1940s, that refinery planners still run
        every day. Press "Use the planner's recipe" to see what it finds, then try to beat it by hand (you can match it but not beat
        it).
      </p>
      <h3>About this model</h3>
      <p className="muted">
        Specs are EN 228 E10 petrol and EN 590 diesel, simplified. Component properties are typical values from the units upstream,
        which change as you run them. Octane blending is linear in volume with ethanol's blending octane, without the interaction terms
        real blenders fit to their own data. The optimiser is a dense simplex with Bland's rule.
      </p>
    </div>
  )
}
