import { useMemo, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { usePlantClock } from './clock.ts'
import { assessDrill, DRILLS, liveFlare, type Drill, type DrillAction } from './drills.ts'
import { flameLength, flareHeat, radiation, RADIATION_LIMITS, RECEIVERS, RELIEF_CASES, safeDistance, steamVerdict } from './flare.ts'
import { SafetyIcon } from './icons.tsx'
import { checkPermit, DEVIATIONS, GAS_LIMITS, HAZOP_NODE, hazopOptions, INCIDENTS, PERMIT_JOBS, type HazopColumn, type PermitCheck, type PermitJob } from './permits.ts'
import { controls, usePlant, type Plant } from './plant.ts'
import { getSafety, safety, useSafety, type RunningDrill, type SafetyState } from './safetyStore.ts'
import { clock, CurveChart, Slider } from './ui.tsx'
import './Refinery.css'

type Tab = 'drills' | 'flare' | 'permits' | 'hazop' | 'incidents'

/** Safety and emergencies: drills on the live plant, the flare, permits to work, a HAZOP and the incidents behind them. */
export function SafetyPanel() {
  usePlantClock()
  const plant = usePlant((p) => p)
  const state = useSafety((s) => s)
  const [tab, setTab] = useState<Tab>('drills')

  return (
    <Panel title="Safety and emergencies" subtitle="Drills on the live plant, the flare, permits to work, a HAZOP and the incidents that shaped them" icon={<SafetyIcon />} wide>
      <div className="cdu sf">
        <div className="cdu-bar">
          <div className="segmented" role="tablist" aria-label="Section">
            {(
              [
                ['drills', 'Drills'],
                ['flare', 'Relief and flare'],
                ['permits', 'Permit to work'],
                ['hazop', 'HAZOP'],
                ['incidents', 'Lessons from incidents'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <span className="ac-summary">
            Plant time <strong>{clock(plant.furnace.time)}</strong>
          </span>
        </div>
        {tab === 'drills' && <Drills plant={plant} state={state} />}
        {tab === 'flare' && <Flare plant={plant} state={state} />}
        {tab === 'permits' && <Permits state={state} />}
        {tab === 'hazop' && <Hazop state={state} />}
        {tab === 'incidents' && <Incidents onPractise={setTab} />}
      </div>
    </Panel>
  )
}

function startDrill(d: Drill, plant: Plant) {
  safety.startDrill(d.id, plant.furnace.time)
  d.start?.()
  // Drills run in real time: an emergency doesn't wait.
  if (plant.paused) controls.togglePause()
  controls.setSpeed(1)
}

function Drills({ plant, state }: { plant: Plant; state: SafetyState }) {
  const running = state.drill && DRILLS.find((d) => d.id === state.drill!.id)
  if (running && state.drill) return <LiveDrill drill={running} run={state.drill} plant={plant} state={state} />
  return (
    <>
      <p className="cdu-note">
        Each drill puts a real upset on the live plant and runs in real time. Pick the right actions, in the right order, before it escalates. Everything you
        press is logged, with why it was right or wrong.
      </p>
      <ul className="sf-drills">
        {DRILLS.map((d) => {
          const best = state.best[d.id]
          return (
            <li key={d.id} className="sf-drill">
              <span className={`sf-kind sf-kind-${d.kind}`}>{d.kind === 'emergency' ? 'Emergency' : 'Procedure'}</span>
              <h3>{d.title}</h3>
              <p>{d.briefing}</p>
              <div className="ac-lesson-foot">
                <span className={best !== undefined && best >= 80 ? 'cdu-good' : 'muted'}>
                  {best === undefined ? (d.deadline ? `${Math.round(d.deadline / 60 * 10) / 10} minutes to act` : 'No clock') : `Best ${best} of 100`}
                </span>
                <button className="button button-primary" onClick={() => startDrill(d, plant)}>
                  Start the drill
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** A fixed, scrambled order for a drill's actions, so the right sequence isn't simply top to bottom. */
function scrambled(actions: DrillAction[]) {
  const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7)
  return [...actions].sort((a, b) => hash(a.id) - hash(b.id))
}

const VERDICTS = { right: 'Right', early: 'Not yet', wrong: 'Wrong', repeat: 'Already done' }

function LiveDrill({ drill, run, plant, state }: { drill: Drill; run: RunningDrill; plant: Plant; state: SafetyState }) {
  const elapsed = plant.furnace.time - run.startedAt
  const a = assessDrill(drill, run.taken, elapsed)
  const actions = useMemo(() => scrambled(drill.actions), [drill])
  const over = a.status === 'safe' || a.status === 'recovered'
  const flare = liveFlare(state, plant.furnace.time)

  const act = (action: DrillAction) => {
    safety.takeAction(action.id, plant.furnace.time)
    // Read the drill back from the store: this render's copy doesn't have the action yet.
    const run = getSafety().drill!
    const after = assessDrill(drill, run.taken, plant.furnace.time - run.startedAt)
    if (after.log.at(-1)?.verdict === 'right') action.effect?.()
  }
  const backToNormal = () => {
    drill.restore?.()
    safety.endDrill()
  }

  return (
    <div className="sf-live">
      <div className={`sf-alarm${over ? ' sf-alarm-over' : ''}`} role="alert">
        <strong>{over ? 'DRILL OVER' : 'DRILL'}</strong> {drill.alarm}
      </div>
      <div className="sf-live-grid">
        <div>
          <h3>{drill.title}</h3>
          <p>{drill.briefing}</p>
          {drill.deadline !== null && (
            <div className="sf-timer">
              <span>
                {clock(Math.min(elapsed, a.status === 'running' || a.status === 'escalated' ? elapsed : (a.log.at(-1)?.at ?? elapsed)))} of {clock(drill.deadline)}
              </span>
              <div className="sf-timer-bar" aria-hidden="true">
                <i className={elapsed > drill.deadline ? 'late' : elapsed > drill.deadline * 0.7 ? 'close' : ''} style={{ width: `${Math.min(100, (elapsed / drill.deadline) * 100)}%` }} />
              </div>
            </div>
          )}
          {a.status === 'escalated' && <p className="sf-escalated">{drill.escalation}</p>}
          <dl className="sf-readings">
            <div>
              <dt>FI-100 crude</dt>
              <dd>{plant.furnace.feed.toFixed(0)} kb/d</dd>
            </div>
            <div>
              <dt>TI-101 outlet</dt>
              <dd className={plant.furnace.outlet > 380 ? 'cdu-bad' : ''}>{plant.furnace.outlet.toFixed(1)} °C</dd>
            </div>
            <div>
              <dt>FV-101 fuel</dt>
              <dd>
                {plant.furnace.valve.toFixed(0)}% · {plant.furnace.mode === 'auto' ? 'AUTO' : 'MAN'}
              </dd>
            </div>
            <div>
              <dt>FI-1900 flare</dt>
              <dd className={flare > 10 ? 'cdu-bad' : ''}>{flare.toFixed(1)} t/h</dd>
            </div>
          </dl>
        </div>
        <div>
          <h4 className="sf-sub">
            Actions · {a.done} of {a.required} done
          </h4>
          <div className="sf-actions">
            {actions.map((x) => {
              const last = [...a.log].reverse().find((l) => l.action.id === x.id)
              const done = last?.verdict === 'right'
              return (
                <button
                  key={x.id}
                  className={`button sf-action${done ? ' sf-done' : last?.verdict === 'wrong' ? ' sf-wrong' : last?.verdict === 'early' ? ' sf-early' : ''}`}
                  onClick={() => act(x)}
                  disabled={over || done || last?.verdict === 'wrong'}
                >
                  {x.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {a.log.length > 0 && (
        <ol className="sf-log">
          {a.log.map((l, i) => (
            <li key={i} className={`sf-log-${l.verdict}`}>
              <span className="sf-log-time">{clock(l.at)}</span>
              <strong>{VERDICTS[l.verdict]}:</strong> {l.action.label}. <span className="muted">{l.verdict === 'early' ? 'Something else has to come first.' : l.action.why}</span>
            </li>
          ))}
        </ol>
      )}
      {over ? (
        <div className={`sf-result sf-result-${a.status}`}>
          <p className="ac-score">
            {a.score} <small>of 100</small>
          </p>
          <h3>{a.status === 'safe' ? 'Made safe' : 'Recovered, but too late'}</h3>
          <p>{drill.debrief}</p>
          <div className="ac-buttons">
            <button
              className="button"
              onClick={() => {
                drill.restore?.()
                startDrill(drill, plant)
              }}
            >
              Run it again
            </button>
            <button className="button button-primary" onClick={backToNormal}>
              Back to normal running
            </button>
          </div>
        </div>
      ) : (
        <div className="ac-buttons sf-abandon">
          <button className="button button-quiet" onClick={backToNormal}>
            Stop the drill and put the plant back
          </button>
        </div>
      )}
    </div>
  )
}

function Flare({ plant, state }: { plant: Plant; state: SafetyState }) {
  const [caseId, setCaseId] = useState('cooling')
  const [load, setLoad] = useState(120)
  const [height, setHeight] = useState(60)
  const [steam, setSteam] = useState(0.4)
  const mw = flareHeat(load)
  const length = flameLength(mw)
  const verdict = steamVerdict(steam)
  const testing = state.flareTest && plant.furnace.time < state.flareTest.until
  const live = liveFlare(state, plant.furnace.time)

  const curve = useMemo(() => {
    const points: [number, number][] = []
    for (let d = 0; d <= 300; d += 5) points.push([d, radiation(mw, d, height)])
    return points
  }, [mw, height])
  const peak = Math.max(2, ...curve.map((p) => p[1]))

  return (
    <div className="sf-flare">
      <p className="cdu-note">
        Relief valves protect every vessel from overpressure, and the flare burns what they release, high enough that its heat is safe on the ground. This is API
        521’s simple method: the flame’s heat, a quarter of it radiated, spreading from the flame’s centre.
      </p>
      <div className="sf-cases segmented" role="group" aria-label="Relief case">
        {RELIEF_CASES.map((c) => (
          <button
            key={c.id}
            className="button"
            aria-pressed={caseId === c.id}
            onClick={() => {
              setCaseId(c.id)
              setLoad(c.load)
            }}
          >
            {c.name}
          </button>
        ))}
      </div>
      <p className="cdu-note">{RELIEF_CASES.find((c) => c.id === caseId)?.why}</p>
      <div className="sf-flare-grid">
        <FlareDrawing mw={mw} length={length} height={height} steam={verdict.state} />
        <div>
          <Slider label="Relief load" unit="t/h" min={0} max={300} step={5} value={load} onChange={(v) => (setLoad(v), setCaseId(''))} />
          <Slider label="Stack height" unit="m" min={30} max={120} step={5} value={height} onChange={setHeight} />
          <Slider label="Steam to the tip" unit="kg/kg" min={0} max={1.2} step={0.05} value={steam} onChange={setSteam} digits={2} />
          <dl className="sf-readings">
            <div>
              <dt>Heat released</dt>
              <dd>{mw.toFixed(0)} MW</dd>
            </div>
            <div>
              <dt>Flame length</dt>
              <dd>{length.toFixed(0)} m</dd>
            </div>
            <div>
              <dt>At the stack’s foot</dt>
              <dd>{radiation(mw, 0, height).toFixed(2)} kW/m²</dd>
            </div>
          </dl>
          <p className={`cdu-note sf-steam-${verdict.state}`}>{verdict.text}</p>
        </div>
      </div>
      <div className="sf-flare-grid">
        <CurveChart
          label="Radiation on the ground against distance from the stack"
          x={{ min: 0, max: 300, label: 'Distance from the stack, m' }}
          y={{ min: 0, max: Math.ceil(peak), label: 'kW/m²' }}
          curves={[{ name: 'Radiation at ground level', colour: '#ff9a3a', points: curve }]}
          lines={[
            { y: 1.58, label: '1.58 anyone' },
            { y: 4.73, label: '4.73 a few minutes' },
          ].filter((l) => l.y <= peak)}
        />
        <table className="sf-table">
          <thead>
            <tr>
              <th>Where, on a full-size site</th>
              <th>kW/m²</th>
            </tr>
          </thead>
          <tbody>
            {RECEIVERS.map((r) => {
              const k = radiation(mw, r.distance, height)
              return (
                <tr key={r.name}>
                  <td>
                    {r.name} <small className="muted">{r.distance} m</small>
                  </td>
                  <td className={k > 4.73 ? 'cdu-bad' : k > 1.58 ? 'sf-warn' : 'cdu-good'}>{k.toFixed(2)}</td>
                </tr>
              )
            })}
            {RADIATION_LIMITS.map((l) => (
              <tr key={l.kw} className="muted">
                <td>
                  {l.label} ({l.kw})
                </td>
                <td>{safeDistance(mw, l.kw, height) > 0 ? `${safeDistance(mw, l.kw, height).toFixed(0)} m out` : 'everywhere'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sf-test">
        <span>
          The site flare is burning <strong>{live.toFixed(1)} t/h</strong> now.
        </span>
        <button className="button" onClick={() => safety.testFlare(load, plant.furnace.time + 180)} disabled={!!testing || load <= 1}>
          {testing ? 'Test firing: walk out on site to see it' : `Test-fire the site flare at ${load} t/h for three minutes`}
        </button>
      </div>
    </div>
  )
}

/** The stack and its flame side on, to scale, with the radiation contours where they reach the ground. */
function FlareDrawing({ mw, length, height, steam }: { mw: number; length: number; height: number; steam: 'smoky' | 'smokeless' | 'oversteamed' }) {
  const ground = 236
  const x0 = 26
  const k = 1
  const tip = ground - height * k
  const flameTop = tip - length * k
  const centre = { x: x0, y: tip - (length * k) / 2 }
  const width = Math.max(4, length * 0.22)
  const lift = steam === 'oversteamed' ? 6 : 0
  const band = []
  for (let d = 0; d < 340; d += 4) {
    const r = radiation(mw, d, height)
    const colour = r > 6.31 ? '#d9442b' : r > 4.73 ? '#f07a3a' : r > 1.58 ? '#e8c050' : '#4f8f5f'
    band.push(<rect key={d} x={x0 + d * k} y={ground} width={4 * k + 0.5} height={8} fill={colour} />)
  }
  return (
    <svg className="sf-drawing" viewBox="0 0 360 260" role="img" aria-label={`The flare: ${height} m stack, flame ${length.toFixed(0)} m long`}>
      <defs>
        <radialGradient id="sf-flame" cx="50%" cy="70%" r="60%">
          <stop offset="0%" stopColor="#fff4c0" />
          <stop offset="45%" stopColor={steam === 'smoky' ? '#e0782a' : '#ffb34a'} />
          <stop offset="100%" stopColor={steam === 'smoky' ? '#7a3a1a' : '#ff6a2a'} stopOpacity="0.85" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="360" height={ground} className="sf-sky" />
      {RADIATION_LIMITS.slice(0, 3).map((l) => {
        const r = Math.sqrt((0.25 * mw * 1000) / (4 * Math.PI * l.kw)) * k
        return <circle key={l.kw} cx={centre.x} cy={centre.y} r={r} className="sf-contour" />
      })}
      {band}
      <line x1="0" x2="360" y1={ground} y2={ground} className="sf-ground" />
      <rect x={x0 - 2} y={tip} width="4" height={height * k} className="sf-stack" />
      {length > 0.5 && (
        <ellipse cx={x0} cy={tip - (length * k) / 2 - lift} rx={width / 2} ry={(length * k) / 2} fill="url(#sf-flame)" className={`sf-flame sf-flame-${steam}`} />
      )}
      {steam === 'smoky' && length > 2 && (
        <g className="sf-smoke">
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={x0 + 6 + i * 9} cy={flameTop - 4 - i * 7} r={5 + i * 3} />
          ))}
        </g>
      )}
      {RECEIVERS.map((r) => (
        <g key={r.name}>
          <line x1={x0 + r.distance * k} x2={x0 + r.distance * k} y1={ground - 10} y2={ground} className="sf-receiver" />
          <text x={x0 + r.distance * k} y={ground - 13} textAnchor="middle" className="sf-receiver-label">
            {r.name.split(' ')[0]}
          </text>
        </g>
      ))}
      <text x={x0 + 6} y={tip + 10} className="sf-receiver-label">
        {height} m
      </text>
      <text x="354" y="252" textAnchor="end" className="sf-receiver-label">
        to scale · 340 m across
      </text>
    </svg>
  )
}

function Permits({ state }: { state: SafetyState }) {
  const [jobId, setJobId] = useState(PERMIT_JOBS[0].id)
  const job = PERMIT_JOBS.find((j) => j.id === jobId)!
  return (
    <>
      <p className="cdu-note">
        No work starts on a live plant without a permit. Choose the controls the job needs (and only those), read the gas test, and issue it.
      </p>
      <div className="segmented sf-jobs" role="group" aria-label="Job">
        {PERMIT_JOBS.map((j) => (
          <button key={j.id} className="button" aria-pressed={jobId === j.id} onClick={() => setJobId(j.id)}>
            {state.permits.includes(j.id) ? '✓ ' : ''}
            {j.type}
          </button>
        ))}
      </div>
      <PermitForm key={job.id} job={job} />
    </>
  )
}

function PermitForm({ job }: { job: PermitJob }) {
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [gas, setGas] = useState<boolean | null>(null)
  const [result, setResult] = useState<PermitCheck | null>(null)
  const toggle = (id: string) => {
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setChosen(next)
    setResult(null)
  }
  const issue = () => {
    if (gas === null) return
    const r = checkPermit(job, chosen, gas)
    setResult(r)
    if (r.passed) safety.passPermit(job.id)
  }
  const reading = (v: number, bad: boolean) => <strong className={bad ? 'cdu-bad' : 'cdu-good'}>{v}</strong>
  return (
    <div className="sf-permit">
      <div className="sf-permit-card">
        <small>{job.type} permit</small>
        <h3>{job.title}</h3>
        <p className="muted">{job.where}</p>
        <p>{job.description}</p>
        <h4 className="sf-sub">Controls</h4>
        <ul className="sf-controls">
          {job.controls.map((c) => {
            const marked = result && ((c.needed && !chosen.has(c.id)) || (!c.needed && chosen.has(c.id)))
            return (
              <li key={c.id} className={marked ? 'sf-marked' : ''}>
                <label>
                  <input type="checkbox" checked={chosen.has(c.id)} onChange={() => toggle(c.id)} /> {c.label}
                </label>
                {result && (marked || chosen.has(c.id)) && <small>{c.why}</small>}
              </li>
            )
          })}
        </ul>
      </div>
      <div>
        <div className="sf-detector" aria-label="Gas test readings">
          <small>Gas test at the work site</small>
          <div>
            LEL {reading(job.gas.lel, job.gas.lel >= (job.type.startsWith('Confined') ? GAS_LIMITS.lelEntry : GAS_LIMITS.lel))} %
          </div>
          <div>O₂ {reading(job.gas.oxygen, job.gas.oxygen < GAS_LIMITS.oxygenMin || job.gas.oxygen > GAS_LIMITS.oxygenMax)} %</div>
          <div>H₂S {reading(job.gas.h2s, job.gas.h2s >= GAS_LIMITS.h2s)} ppm</div>
        </div>
        <p className="cdu-note">
          Limits: flammable gas under {GAS_LIMITS.lel}% of the lower explosive limit ({GAS_LIMITS.lelEntry}% to enter a vessel), oxygen {GAS_LIMITS.oxygenMin}–
          {GAS_LIMITS.oxygenMax}%, H₂S under {GAS_LIMITS.h2s} ppm.
        </p>
        <div className="segmented" role="group" aria-label="Gas test">
          <button className="button" aria-pressed={gas === true} onClick={() => (setGas(true), setResult(null))}>
            Safe to start
          </button>
          <button className="button" aria-pressed={gas === false} onClick={() => (setGas(false), setResult(null))}>
            Not safe yet
          </button>
        </div>
        <div className="ac-buttons sf-issue">
          <button className="button button-primary" onClick={issue} disabled={gas === null}>
            Issue the permit
          </button>
        </div>
        {result && (
          <div className={`ac-why ${result.passed ? 'ac-why-right' : 'ac-why-wrong'}`} role="status">
            <strong>{result.passed ? 'Permit issued.' : 'Not yet.'}</strong>{' '}
            {result.passed
              ? result.unneeded.length
                ? `Safe, though ${result.unneeded.length === 1 ? 'one control wasn’t' : `${result.unneeded.length} controls weren’t`} needed: needless controls make permits slow and get them ignored.`
                : 'Every control the job needs, and nothing it doesn’t.'
              : [
                  result.missed.length ? `${result.missed.length} control${result.missed.length === 1 ? '' : 's'} missing, marked above.` : '',
                  result.gasRight ? '' : `The gas test: ${job.gas.why}`,
                ]
                  .filter(Boolean)
                  .join(' ')}
            {result.passed && <div className="muted">{job.gas.why}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

const COLUMNS: { id: HazopColumn; label: string }[] = [
  { id: 'cause', label: 'Cause' },
  { id: 'consequence', label: 'Consequence' },
  { id: 'safeguard', label: 'Safeguard' },
]

function Hazop({ state }: { state: SafetyState }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const total = DEVIATIONS.length * COLUMNS.length
  const right = DEVIATIONS.reduce((n, d, i) => n + COLUMNS.filter((c) => answers[`${i}-${c.id}`] === d[c.id]).length, 0)
  const check = () => {
    setChecked(true)
    safety.scoreHazop(right / total)
  }
  return (
    <div className="sf-hazop">
      <p className="cdu-note">
        A HAZOP takes one part of the plant at a time and asks, for each guide word, what could make it happen, what would follow and what protects
        against it. Fill in the worksheet for this node.
      </p>
      <div className="sf-node">
        <strong>Node: {HAZOP_NODE.name}</strong>
        <span className="muted">Design intent: {HAZOP_NODE.intent}</span>
      </div>
      <div className="sf-worksheet">
        <table className="sf-table">
          <thead>
            <tr>
              <th>Guide word</th>
              {COLUMNS.map((c) => (
                <th key={c.id}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEVIATIONS.map((d, i) => (
              <tr key={i}>
                <td>
                  <strong>{d.guide}</strong>
                  <br />
                  <small className="muted">{d.parameter}</small>
                </td>
                {COLUMNS.map((c) => {
                  const key = `${i}-${c.id}`
                  const value = answers[key] ?? ''
                  const mark = checked && value ? (value === d[c.id] ? 'sf-cell-right' : 'sf-cell-wrong') : checked ? 'sf-cell-wrong' : ''
                  return (
                    <td key={c.id} className={mark}>
                      <select
                        value={value}
                        onChange={(e) => {
                          setAnswers({ ...answers, [key]: e.target.value })
                          setChecked(false)
                        }}
                        aria-label={`${d.guide} ${d.parameter}: ${c.label}`}
                      >
                        <option value="">Choose…</option>
                        {hazopOptions(i, c.id).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                      {checked && value !== d[c.id] && <small className="sf-answer">{d[c.id]}</small>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sf-test">
        <span>
          {checked ? (
            <>
              <strong>{right}</strong> of {total} right.{' '}
            </>
          ) : null}
          {state.hazop > 0 && <span className="muted">Best {Math.round(state.hazop * total)} of {total}.</span>}
        </span>
        <button className="button button-primary" onClick={check}>
          Check the worksheet
        </button>
      </div>
    </div>
  )
}

const PRACTISE: Record<string, string> = { drills: 'Run the drills', flare: 'Size the flare', permits: 'Issue a permit', hazop: 'Do the HAZOP' }

function Incidents({ onPractise }: { onPractise: (t: Tab) => void }) {
  return (
    <>
      <p className="cdu-note">Most of what a refinery does for safety was learnt the hard way. Four incidents that changed how plants are run.</p>
      <div className="sf-incidents">
        {INCIDENTS.map((i) => (
          <article key={i.id} className="sf-incident">
            <small>
              {i.date} · {i.place}
            </small>
            <h3>{i.name}</h3>
            <p className="sf-toll">{i.toll}</p>
            <p>{i.what}</p>
            <h4 className="sf-sub">What went wrong</h4>
            <ul>
              {i.causes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <h4 className="sf-sub">What the industry learnt</h4>
            <ul>
              {i.lessons.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <button className="button" onClick={() => onPractise(i.practise)}>
              {PRACTISE[i.practise]}
            </button>
          </article>
        ))}
      </div>
    </>
  )
}
