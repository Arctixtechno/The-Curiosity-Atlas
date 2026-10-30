import { useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { openOverlay } from '../../world/overlay.ts'
import { usePlantClock } from './clock.ts'
import { FCC_LIMITS } from './fcc.ts'
import { SHELVE_SECONDS, TAG, type DcsAlarm, type Priority, type TagDef, type UnitArea } from './dcs.ts'
import { DcsIcon } from './icons.tsx'
import { BLENDING_OVERLAY, CDU_OVERLAY, CONVERSION_OVERLAY, HEAVY_END_OVERLAY, LIGHT_ENDS_OVERLAY, REFORMER_OVERLAY, SITE_OVERLAY, TREATING_OVERLAY } from './overlayIds.ts'
import { controls, conversionResult, reformingResult, usePlant, type Plant, type TagSample } from './plant.ts'
import { REFORMER_LIMITS } from './reformer.ts'
import { clock, SimClock, Slider } from './ui.tsx'
import './Refinery.css'

type Tab = 'overview' | 'alarms' | 'trends' | 'apc' | 'learn'

const AREAS: { id: UnitArea; name: string; overlay: string; tags: string[] }[] = [
  { id: 'cdu', name: 'Crude unit', overlay: CDU_OVERLAY, tags: ['FI-100', 'TI-101', 'TI-102', 'FI-104'] },
  { id: 'fcc', name: 'Cat cracker', overlay: CONVERSION_OVERLAY, tags: ['FI-301', 'TI-301', 'TI-302', 'FI-303', 'FI-304'] },
  { id: 'reformer', name: 'Reformer', overlay: REFORMER_OVERLAY, tags: ['TI-501', 'AI-502', 'FI-503'] },
  { id: 'treating', name: 'Hydrotreating and sulphur', overlay: TREATING_OVERLAY, tags: ['AI-603', 'FI-604', 'AI-701'] },
  { id: 'lightEnds', name: 'Light ends', overlay: LIGHT_ENDS_OVERLAY, tags: ['AI-803', 'AI-1001', 'AI-1002'] },
  { id: 'heavyEnd', name: 'Heavy end', overlay: HEAVY_END_OVERLAY, tags: ['LI-1201', 'TI-1302', 'AI-1303', 'TI-1401'] },
  { id: 'blending', name: 'Blending', overlay: BLENDING_OVERLAY, tags: ['AI-1101', 'AI-1102'] },
  { id: 'tanks', name: 'Tank farm', overlay: SITE_OVERLAY, tags: ['LI-crude', 'LI-vgo', 'LI-petrol', 'LI-diesel', 'LI-fuelOil'] },
  { id: 'site', name: 'Site', overlay: SITE_OVERLAY, tags: ['MARGIN'] },
]

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const PRIORITY_NAME: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' }

/** The control room's DCS: one overview of every unit, the alarm list, trends, and advanced control. */
export function DcsPanel() {
  usePlantClock()
  const plant = usePlant((p) => p)
  const [tab, setTab] = useState<Tab>('overview')
  const visible = plant.dcsAlarms.filter((a) => a.shelvedUntil === undefined)
  const unacked = visible.filter((a) => !a.acked).length
  return (
    <Panel title="Control room" subtitle="The DCS at Marshgate: every unit on one screen, alarms, trends and advanced control" icon={<DcsIcon />} wide>
      <div className="cdu dcs">
        <div className="cdu-bar">
          <div className="segmented" role="tablist" aria-label="Screen">
            {(
              [
                ['overview', 'Overview'],
                ['alarms', `Alarms${unacked ? ` (${unacked})` : ''}`],
                ['trends', 'Trends'],
                ['apc', 'Advanced control'],
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
        <AlarmBanner alarms={visible} onOpen={() => setTab('alarms')} />
        {tab === 'overview' && <Overview plant={plant} />}
        {tab === 'alarms' && <Alarms plant={plant} />}
        {tab === 'trends' && <Trends plant={plant} />}
        {tab === 'apc' && <Apc plant={plant} />}
        {tab === 'learn' && <Learn />}
      </div>
    </Panel>
  )
}

/** The newest, most urgent unacknowledged alarm, always in view, like the banner across the top of a real DCS. */
function AlarmBanner({ alarms, onOpen }: { alarms: DcsAlarm[]; onOpen: () => void }) {
  const unacked = alarms.filter((a) => !a.acked).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.time - a.time)
  const top = unacked[0]
  const counts = (['high', 'medium', 'low'] as const).map((p) => [p, alarms.filter((a) => a.active && a.priority === p).length] as const)
  return (
    <div className={`dcs-banner${top ? ` dcs-banner-${top.priority}` : ''}`} role="status" aria-live="polite">
      <div className="dcs-counts">
        {counts.map(([p, n]) => (
          <span key={p} className={`dcs-count dcs-count-${p}`} title={`${PRIORITY_NAME[p]} priority alarms standing`}>
            <PriorityMark priority={p} /> {n}
          </span>
        ))}
      </div>
      {top ? (
        <>
          <span className="dcs-banner-text">
            <time>{clock(top.time)}</time> {top.text}
          </span>
          <button className="button" onClick={() => controls.ackAlarm(top.id)}>
            Acknowledge
          </button>
          <button className="button button-quiet" onClick={onOpen}>
            All alarms
          </button>
        </>
      ) : (
        <span className="dcs-banner-text muted">No unacknowledged alarms.</span>
      )}
    </div>
  )
}

/** Alarm priority by shape as well as colour, so it reads without colour too. */
function PriorityMark({ priority }: { priority: Priority }) {
  return (
    <svg className={`dcs-mark dcs-mark-${priority}`} viewBox="0 0 12 12" aria-label={`${PRIORITY_NAME[priority]} priority`} role="img">
      {priority === 'high' ? <path d="M6 0.5 L11.5 6 L6 11.5 L0.5 6 Z" /> : priority === 'medium' ? <path d="M6 1 L11.5 11 L0.5 11 Z" /> : <rect x="1.5" y="1.5" width="9" height="9" rx="1" />}
    </svg>
  )
}

/* ---------------- Overview ---------------- */

function tagState(t: TagDef, v: number): Priority | null {
  if ((t.hh !== undefined && v >= t.hh) || (t.ll !== undefined && v <= t.ll)) return 'high'
  if ((t.hi !== undefined && v >= t.hi) || (t.lo !== undefined && v <= t.lo)) return 'medium'
  return null
}

function Overview({ plant }: { plant: Plant }) {
  const recent = plant.tagHistory.filter((s) => s.time >= plant.furnace.time - 1800)
  return (
    <div className="dcs-overview">
      {AREAS.map((area) => {
        const alarms = plant.dcsAlarms.filter((a) => a.area === area.id && a.active && a.shelvedUntil === undefined)
        const worst = alarms.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])[0]
        return (
          <section key={area.id} className={`dcs-area${worst ? ` dcs-area-${worst.priority}` : ''}`}>
            <header>
              <h3>{area.name}</h3>
              {worst && <PriorityMark priority={worst.priority} />}
              <button className="button button-quiet" onClick={() => openOverlay(area.overlay)}>
                Open
              </button>
            </header>
            {area.tags.map((id) => (
              <TagRow key={id} tag={TAG[id]} value={plant.tags[id]} history={recent} />
            ))}
          </section>
        )
      })}
    </div>
  )
}

/** A tag as ISA-101 would draw it: grey when normal, coloured only when it's in alarm, with its limits on a bar and its last half hour beside. */
function TagRow({ tag, value, history }: { tag: TagDef; value: number | undefined; history: TagSample[] }) {
  if (value === undefined) return null
  const [min, max] = tag.range
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`
  const state = tagState(tag, value)
  const points = history.map((s) => s.values[tag.id]).filter((v) => v !== undefined)
  const spark =
    points.length > 1
      ? points.map((v, i) => `${((i / (points.length - 1)) * 60).toFixed(1)},${(18 - Math.min(1, Math.max(0, (v - min) / (max - min))) * 16).toFixed(1)}`).join(' ')
      : ''
  return (
    <div className={`dcs-tag${state ? ` dcs-tag-${state}` : ''}`} title={tag.name}>
      <span className="dcs-tag-id">{tag.id}</span>
      <span className="dcs-tag-name">{tag.name}</span>
      <div className="dcs-bar">
        {tag.lo !== undefined && <span className="dcs-bar-limit" style={{ left: at(tag.lo) }} />}
        {tag.hi !== undefined && <span className="dcs-bar-limit" style={{ left: at(tag.hi) }} />}
        {tag.hh !== undefined && <span className="dcs-bar-limit dcs-bar-limit-hh" style={{ left: at(tag.hh) }} />}
        <span className="dcs-bar-pointer" style={{ left: at(value) }} />
      </div>
      <svg className="dcs-spark" viewBox="0 0 60 20" aria-hidden="true">
        {spark && <polyline points={spark} />}
      </svg>
      <output>
        {value.toFixed(tag.digits)} <small>{tag.units}</small>
      </output>
    </div>
  )
}

/* ---------------- Alarms ---------------- */

function Alarms({ plant }: { plant: Plant }) {
  const [showShelved, setShowShelved] = useState(false)
  const alarms = plant.dcsAlarms
    .filter((a) => showShelved || a.shelvedUntil === undefined)
    .sort((a, b) => Number(a.acked) - Number(b.acked) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.time - a.time)
  const lastHour = plant.dcsAlarms.filter((a) => a.time >= plant.furnace.time - 3600).length
  const shelved = plant.dcsAlarms.filter((a) => a.shelvedUntil !== undefined).length
  return (
    <div className="cdu-card">
      <div className="bl-buttons">
        <button className="button" onClick={controls.ackAllAlarms} disabled={!alarms.some((a) => !a.acked)}>
          Acknowledge all
        </button>
        <label className="sm-check">
          <input type="checkbox" checked={showShelved} onChange={(e) => setShowShelved(e.target.checked)} /> Show shelved ({shelved})
        </label>
      </div>
      <p className={`cdu-note${lastHour > 6 ? ' cdu-bad' : ' muted'}`}>
        {lastHour} alarm{lastHour === 1 ? '' : 's'} in the last plant hour. The EEMUA 191 guide asks for no more than about six an hour per operator
        in steady running, or alarms stop being read.
      </p>
      {alarms.length === 0 ? (
        <p className="muted">The alarm list is empty. Every tag is inside its limits.</p>
      ) : (
        <table className="sm-table dcs-alarms">
          <thead>
            <tr>
              <th>Time</th>
              <th>Priority</th>
              <th>Alarm</th>
              <th>State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {alarms.map((a) => (
              <tr key={a.id} className={`dcs-alarm-row${!a.acked && a.active ? ' dcs-alarm-new' : ''}`}>
                <td>{clock(a.time)}</td>
                <td>
                  <PriorityMark priority={a.priority} /> {PRIORITY_NAME[a.priority]}
                </td>
                <td>{a.text}</td>
                <td>{a.shelvedUntil !== undefined ? 'Shelved' : a.active ? (a.acked ? 'Active' : 'Active, new') : 'Cleared, not acknowledged'}</td>
                <td className="dcs-actions">
                  {!a.acked && (
                    <button className="button button-quiet" onClick={() => controls.ackAlarm(a.id)}>
                      Ack
                    </button>
                  )}
                  {a.active && a.shelvedUntil === undefined && (
                    <button className="button button-quiet" onClick={() => controls.shelveAlarm(a.id, SHELVE_SECONDS)} title="Hide it for an hour of plant time">
                      Shelve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ---------------- Trends ---------------- */

const PEN_COLOURS = ['#f0c050', '#7fc8f8', '#ff8a6a', '#8fe3a4']
const SPANS = [
  [1800, '30 min'],
  [7200, '2 hours'],
] as const

function Trends({ plant }: { plant: Plant }) {
  const [pens, setPens] = useState<string[]>(['TI-101', 'TI-302', 'AI-502', 'MARGIN'])
  const [span, setSpan] = useState<number>(1800)
  const toggle = (id: string) => setPens((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? [...p.slice(1), id] : [...p, id]))
  return (
    <div className="cdu-grid">
      <section className="cdu-card cdu-wide">
        <div className="cdu-bar">
          <span className="muted">Up to four pens, each on its own scale. Changes take as long to show here as they would on a real unit.</span>
          <div className="segmented" aria-label="Time span">
            {SPANS.map(([s, label]) => (
              <button key={s} className="button" aria-pressed={span === s} onClick={() => setSpan(s)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <TrendChart plant={plant} pens={pens} span={span} />
      </section>
      <section className="cdu-card cdu-wide">
        <h3>Pick the pens</h3>
        <div className="dcs-pens">
          {AREAS.map((area) => (
            <div key={area.id}>
              <h4>{area.name}</h4>
              {area.tags.map((id) => (
                <button key={id} className="button button-quiet dcs-pen" aria-pressed={pens.includes(id)} onClick={() => toggle(id)}>
                  {pens.includes(id) && <span className="cdu-swatch" style={{ background: PEN_COLOURS[pens.indexOf(id)] }} />} {id} <small>{TAG[id].name}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function TrendChart({ plant, pens, span }: { plant: Plant; pens: string[]; span: number }) {
  const W = 920
  const H = 300
  const pad = { l: 20 + pens.length * 46, r: 14, t: 12, b: 26 }
  const end = plant.furnace.time
  const start = end - span
  const samples = plant.tagHistory.filter((s) => s.time >= start)
  const sx = (t: number) => pad.l + ((t - start) / span) * (W - pad.l - pad.r)
  const ticks = Array.from({ length: 7 }, (_, i) => start + (span * i) / 6)
  return (
    <svg className="cdu-tbp dcs-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Trend of ${pens.join(', ')}`}>
      <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} className="cdu-trend-bg" />
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + f * (H - pad.t - pad.b)} y2={pad.t + f * (H - pad.t - pad.b)} className="dcs-grid" />
      ))}
      {ticks.map((t) => (
        <text key={t} x={sx(t)} y={H - 8} textAnchor="middle">
          {t < 0 ? '' : clock(t).slice(0, -3)}
        </text>
      ))}
      {pens.map((id, i) => {
        const tag = TAG[id]
        const [min, max] = tag.range
        const sy = (v: number) => pad.t + (1 - (Math.min(max, Math.max(min, v)) - min) / (max - min)) * (H - pad.t - pad.b)
        const colour = PEN_COLOURS[i]
        const x = 14 + i * 46
        const points = samples.filter((s) => s.values[id] !== undefined).map((s) => `${sx(s.time).toFixed(1)},${sy(s.values[id]).toFixed(1)}`)
        const now = plant.tags[id]
        if (now !== undefined) points.push(`${sx(end).toFixed(1)},${sy(now).toFixed(1)}`)
        return (
          <g key={id}>
            <text x={x} y={pad.t + 8} style={{ fill: colour }}>
              {max}
            </text>
            <text x={x} y={H - pad.b} style={{ fill: colour }}>
              {min}
            </text>
            <text x={x} y={(H - pad.b + pad.t) / 2} style={{ fill: colour }}>
              {id}
            </text>
            {tag.hi !== undefined && <line x1={pad.l} x2={W - pad.r} y1={sy(tag.hi)} y2={sy(tag.hi)} className="rf-limit" style={{ stroke: colour, opacity: 0.5 }} />}
            <polyline points={points.join(' ')} style={{ stroke: colour, strokeWidth: 2 }} />
            {now !== undefined && (
              <text x={W - pad.r - 4} y={sy(now) - 6} textAnchor="end" style={{ fill: colour }}>
                {now.toFixed(tag.digits)} {tag.units}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/* ---------------- Advanced control ---------------- */

function Apc({ plant }: { plant: Plant }) {
  const fcc = useMemo(() => conversionResult(plant).fcc, [plant])
  const predicted = useMemo(() => reformingResult(plant).reformer.octane, [plant])
  const cvs = [
    { name: 'Regenerator', value: fcc.regenTemp, limit: FCC_LIMITS.regenMax, unit: '°C', digits: 0 },
    { name: 'Air blower', value: fcc.air, limit: FCC_LIMITS.airMax, unit: 't/h', digits: 0 },
    { name: 'Wet gas compressor', value: fcc.gas, limit: FCC_LIMITS.gasMax, unit: 't/h', digits: 1 },
  ]
  const recent = plant.tagHistory.filter((s) => s.time >= plant.furnace.time - 1800)
  return (
    <div className="cdu-grid">
      <section className="cdu-card">
        <h3>Feed-forward on the crude furnace</h3>
        <p className="cdu-note">
          A crude rate change upsets the furnace: more oil through the same firing cools the outlet, and the temperature controller only
          finds out a minute later, through the dead time and the lag. Feed-forward moves the fuel valve the moment the rate changes,
          by what the new rate will need, and leaves the controller only the small error that's left.
        </p>
        <div className="cdu-row">
          <span>Feed-forward</span>
          <div className="segmented">
            <button className="button" aria-pressed={!plant.feedForward} onClick={() => controls.setFeedForward(false)}>
              Off
            </button>
            <button className="button" aria-pressed={plant.feedForward} onClick={() => controls.setFeedForward(true)}>
              On
            </button>
          </div>
        </div>
        <div className="bl-buttons">
          <span className="muted">Step the crude rate to test it:</span>
          <button className="button" onClick={() => controls.setFeed(Math.max(60, plant.furnace.feed - 10))}>
            −10 kb/d
          </button>
          <button className="button" onClick={() => controls.setFeed(Math.min(120, plant.furnace.feed + 10))}>
            +10 kb/d
          </button>
        </div>
        <TagRow tag={TAG['FI-100']} value={plant.tags['FI-100']} history={recent} />
        <TagRow tag={TAG['TI-101']} value={plant.tags['TI-101']} history={recent} />
        <p className="cdu-note muted">Watch TI-101 on the Trends tab at 10× or 30×: try a step with feed-forward off, then on.</p>
      </section>

      <section className="cdu-card">
        <h3>Cat cracker: maximum throughput</h3>
        <p className="cdu-note">
          A constraint controller pushes the cracker's feed up half a kb/d a minute until it meets the first limit it must respect, then
          holds there, and backs off if the plant moves. It keeps a little margin below each limit.
        </p>
        <div className="cdu-row">
          <span>Controller</span>
          <div className="segmented">
            <button className="button" aria-pressed={!plant.apc.fcc} onClick={() => controls.setApc({ fcc: false })}>
              Off
            </button>
            <button className="button" aria-pressed={plant.apc.fcc} onClick={() => controls.setApc({ fcc: true })}>
              On
            </button>
          </div>
        </div>
        <p className="cdu-note">
          <strong>Feed {plant.fcc.feed.toFixed(1)} kb/d.</strong> {plant.apc.fccStatus}
        </p>
        {cvs.map((c) => (
          <div key={c.name} className={`cv-gauge${c.value > c.limit ? ' cv-gauge-bad' : ''}`}>
            <span>{c.name}</span>
            <div className="cv-gauge-bar">
              <div className="cv-gauge-fill" style={{ width: `${Math.min(100, (c.value / c.limit) * 100)}%` }} />
              <div className="cv-gauge-limit" style={{ left: '100%' }} />
            </div>
            <output>
              {c.value.toFixed(c.digits)} / {c.limit} {c.unit}
            </output>
          </div>
        ))}
        <p className="cdu-note muted">Slide valve: {fcc.limited ? 'at its limit' : 'inside its range'}.</p>
      </section>

      <section className="cdu-card">
        <h3>Reformer: octane control</h3>
        <p className="cdu-note">
          The octane analyser takes a quarter of an hour to show a change, so a controller acting on it alone would overshoot. This one acts on
          its model's prediction of where octane will settle, and moves the reactor inlets half a degree a minute towards the target.
        </p>
        <div className="cdu-row">
          <span>Controller</span>
          <div className="segmented">
            <button className="button" aria-pressed={!plant.apc.reformer} onClick={() => controls.setApc({ reformer: false })}>
              Off
            </button>
            <button className="button" aria-pressed={plant.apc.reformer} onClick={() => controls.setApc({ reformer: true })}>
              On
            </button>
          </div>
        </div>
        <Slider label="Octane target" value={plant.apc.octaneTarget} min={94} max={102} step={0.5} digits={1} unit="RON" onChange={(octaneTarget) => controls.setApc({ octaneTarget })} />
        <dl className="cdu-readings">
          <dt>Inlets</dt>
          <dd>
            {plant.reformer.wait.toFixed(1)} °C <small className="muted">(metal limit {REFORMER_LIMITS.waitMax})</small>
          </dd>
          <dt>Predicted octane</dt>
          <dd>{predicted.toFixed(1)} RON</dd>
          <dt>Analyser AI-502</dt>
          <dd>{(plant.tags['AI-502'] ?? 0).toFixed(1)} RON</dd>
        </dl>
        <p className="cdu-note">{plant.apc.reformerStatus}</p>
      </section>

      <section className="cdu-card">
        <h3>Why advanced control pays</h3>
        <p className="cdu-note">
          Basic controllers hold one measurement at one setpoint. Advanced process control sits above them and moves their setpoints to run
          the unit as close to its real limits as it safely can, every minute of the day, which a person watching forty screens can't.
          Typical benefits are a few per cent more throughput or yield: on a cat cracker, millions of dollars a year.
        </p>
      </section>
    </div>
  )
}

function Learn() {
  return (
    <div className="cdu-learn">
      <h3>The distributed control system</h3>
      <p>
        Every measurement on a refinery (thousands of temperatures, pressures, flows, levels and analysers) comes back to the control room
        as a tag, named by the ISA convention: the first letter is what's measured (T temperature, F flow, L level, A analysis, P pressure),
        then I for an indicator or IC for a controller, then the loop number. The DCS shows them, runs the control loops, and raises alarms.
      </p>
      <h3>Screens that help</h3>
      <p>
        Older control rooms painted every pipe in bright colours. Modern ones follow ISA-101's "high performance HMI": grey screens where
        nothing is coloured unless it needs attention, bar graphs that show where a value sits against its limits, and trends beside the
        numbers, because the direction a value is going matters as much as where it is. That is how this overview is drawn.
      </p>
      <h3>Alarms</h3>
      <p>
        An alarm should mean an operator has to act. Each has a priority, shown by shape as well as colour. The operator acknowledges it
        (I've seen it), it stays standing until the condition clears, and a cleared alarm stays on the list until it's acknowledged.
        Shelving hides a nuisance alarm for a while, on record. Too many alarms is dangerous: at Texaco's Milford Haven refinery in 1994,
        operators faced 275 alarms in the last eleven minutes before an explosion. The EEMUA 191 guide asks for about one alarm every ten
        minutes in normal running.
      </p>
      <h3>Dynamics</h3>
      <p>
        Plants don't jump to a new state. A furnace outlet takes minutes to settle; a regenerator, with tonnes of hot catalyst, ten or more;
        an octane analyser has to take a sample, run it and report, so it lags by a quarter of an hour. The models on the unit screens tell
        you where a unit will settle. The DCS tags here move towards that over each measurement's own time constant, the way they would on a
        real plant.
      </p>
      <h3>About this model</h3>
      <p className="muted">
        Tags follow first-order lags with typical time constants towards the steady-state models' values; the crude furnace is fully dynamic
        (first order plus dead time with a PID controller). Alarms are raised on each tag's limits and on each unit's own warnings. The APC
        controllers are simple constraint pushers, not full model predictive control.
      </p>
    </div>
  )
}
