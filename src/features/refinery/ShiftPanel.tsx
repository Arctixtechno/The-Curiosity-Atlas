import { useEffect } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { closeOverlay, openOverlay } from '../../world/overlay.ts'
import { usePlantClock } from './clock.ts'
import { ShiftIcon } from './icons.tsx'
import { LOGBOOK_OVERLAY } from './overlayIds.ts'
import { getPlant, usePlant } from './plant.ts'
import { shifts, useShifts, type ShiftState } from './shiftStore.ts'
import { goalState, SHIFTS, type ShiftResult, type ShiftRun } from './shifts.ts'
import { siteBalance } from './site.ts'
import { clock, money, SimClock } from './ui.tsx'
import './Refinery.css'

const GOAL_MARK = { met: '✓', failing: '•', broken: '✗', waiting: '…' }
const KIND_TEXT = { always: 'Held all shift', never: 'Never broken', end: 'At handover' }

/** The shift desk: pick a shift, follow it as it runs, and read the report when it's handed over. */
export function ShiftPanel() {
  usePlantClock()
  const state = useShifts((s) => s)
  return (
    <Panel title="Shift desk" subtitle="Take a shift on the live plant: something is about to happen, and you’re judged at handover" icon={<ShiftIcon />} wide>
      <div className="cdu shd">
        {state.active ? <Running run={state.active} state={state} /> : state.result ? <Report result={state.result} state={state} /> : <Choose state={state} />}
      </div>
    </Panel>
  )
}

function Stars({ count, of = 3 }: { count: number; of?: number }) {
  return (
    <span className="shd-stars" aria-label={`${count} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < count ? 'on' : ''}>
          ★
        </i>
      ))}
    </span>
  )
}

function Choose({ state }: { state: ShiftState }) {
  return (
    <>
      <p>
        Each shift starts from the same plant, with something about to happen. You run it with every screen on site, at whatever speed you like, and at
        handover you’re judged on what a shift team is judged on: products on spec, the permit, a safe furnace and the margin. Your own plant is kept aside
        and handed back afterwards.
      </p>
      <div className="shd-cards">
        {SHIFTS.map((s) => (
          <article key={s.id} className="shd-card">
            <header>
              <small>{s.when}</small>
              <Stars count={state.best[s.id] ?? 0} />
            </header>
            <h3>{s.title}</h3>
            <p>{s.brief}</p>
            <ul>
              {s.goals.map((g) => (
                <li key={g.id}>
                  {g.text} <small className="muted">· {KIND_TEXT[g.kind]}</small>
                </li>
              ))}
            </ul>
            <footer>
              <span className="muted">{Math.round(s.length / 60)} minutes of plant time</span>
              <button
                className="button button-primary"
                onClick={() => {
                  shifts.start(s.id)
                  closeOverlay()
                }}
              >
                Take the shift
              </button>
            </footer>
          </article>
        ))}
      </div>
    </>
  )
}

function Running({ run, state }: { run: ShiftRun; state: ShiftState }) {
  const plant = usePlant((p) => p)
  const shift = SHIFTS.find((s) => s.id === run.id)!
  const b = siteBalance(plant)
  const into = plant.furnace.time - run.startedAt
  return (
    <>
      <SimClock plant={plant} />
      <div className="shd-running">
        <div>
          <small className="muted">{shift.when}</small>
          <h3>{shift.title}</h3>
          <div className="shd-progress" aria-label={`${clock(into)} of ${clock(shift.length)}`}>
            <i style={{ width: `${Math.min(100, (into / shift.length) * 100)}%` }} />
            {shift.events.map((e) => (
              <b key={e.at} style={{ left: `${(e.at / shift.length) * 100}%` }} title={e.text} />
            ))}
          </div>
          <p className="muted">
            {clock(into)} of {clock(shift.length)} · margin now {money(b.margin)}/day (started at {money(run.context.startMargin)})
          </p>
          <ul className="shd-goals">
            {shift.goals.map((g) => {
              const st = goalState(shift, g, run, plant, b)
              return (
                <li key={g.id} className={`shd-${st}`}>
                  <span aria-hidden="true">{GOAL_MARK[st]}</span>
                  <span>
                    {g.text}
                    <small className="muted"> · {KIND_TEXT[g.kind]}</small>
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="spl-buttons">
            {shift.screens.map((sc) => (
              <button key={sc.overlay} className="button" onClick={() => openOverlay(sc.overlay)}>
                {sc.label}
              </button>
            ))}
            <button className="button button-quiet" onClick={closeOverlay}>
              Walk the site
            </button>
          </div>
        </div>
        <div>
          <h4>Shift log</h4>
          <ol className="shd-log">
            {state.log.map((l, i) => (
              <li key={i}>
                <time>{clock(l.at)}</time> {l.text}
              </li>
            ))}
          </ol>
          <button className="button button-quiet" onClick={shifts.abandon}>
            Give up the shift and get my plant back
          </button>
        </div>
      </div>
    </>
  )
}

function Report({ result, state }: { result: ShiftResult; state: ShiftState }) {
  const shift = SHIFTS.find((s) => s.id === result.id)!
  return (
    <div className="shd-report">
      <small className="muted">
        {shift.when} · handover report
      </small>
      <h3>{shift.title}</h3>
      <Stars count={result.stars} />
      <p>
        {result.stars === 3
          ? 'A clean handover: every goal met.'
          : result.stars === 2
            ? 'A good shift, with one thing the next crew will ask about.'
            : result.stars === 1
              ? 'A difficult shift. The notes below say what would have saved it.'
              : 'Nothing went to plan. Read the notes and take it again.'}
      </p>
      <ul className="shd-goals">
        {shift.goals.map((g) => {
          const r = result.goals.find((x) => x.id === g.id)!
          return (
            <li key={g.id} className={r.met ? 'shd-met' : 'shd-broken'}>
              <span aria-hidden="true">{r.met ? '✓' : '✗'}</span>
              <span>
                {g.text} <small className="muted">· {r.detail}</small>
                {!r.met && <small className="shd-how">{g.how}</small>}
              </span>
            </li>
          )
        })}
      </ul>
      <dl className="sf-readings">
        <div>
          <dt>Average margin</dt>
          <dd>{money(result.averageMargin)}/day</dd>
        </div>
        <div>
          <dt>Hottest furnace outlet</dt>
          <dd>{result.peakOutlet.toFixed(1)} °C</dd>
        </div>
        <div>
          <dt>Best on this shift</dt>
          <dd>
            <Stars count={state.best[shift.id] ?? 0} />
          </dd>
        </div>
      </dl>
      <p className="muted">Your own plant is back as you left it.</p>
      <div className="spl-buttons">
        <button
          className="button button-primary"
          onClick={() => {
            shifts.closeReport()
            shifts.start(shift.id)
            closeOverlay()
          }}
        >
          Take it again
        </button>
        <button className="button" onClick={shifts.closeReport}>
          Choose another shift
        </button>
        <button className="button button-quiet" onClick={() => openOverlay(LOGBOOK_OVERLAY)}>
          Your logbook
        </button>
      </div>
    </div>
  )
}

/** The running shift across the top of the screen, and its referee: the shift moves on as the plant clock does. */
export function ShiftBanner({ hidden, onOpen }: { hidden: boolean; onOpen: () => void }) {
  const run = useShifts((s) => s.active)
  const last = useShifts((s) => s.log.at(-1))
  const time = usePlant((p) => p.furnace.time)
  // Refereed on every tick of the plant clock; it samples only every ten simulated seconds.
  useEffect(() => {
    if (run) shifts.tick()
  }, [run, time])
  if (!run || hidden) return null
  const shift = SHIFTS.find((s) => s.id === run.id)!
  const p = getPlant()
  const b = siteBalance(p)
  const into = time - run.startedAt
  const states = shift.goals.map((g) => goalState(shift, g, run, p, b))
  return (
    <div className="shift-banner" role="status">
      <strong>{shift.title}</strong>
      <span className="shift-banner-clock">
        {clock(Math.max(0, shift.length - into))} left
      </span>
      <span className="shift-banner-goals" aria-label="Goals">
        {states.map((st, i) => (
          <i key={i} className={`shd-${st}`} title={shift.goals[i].text}>
            {GOAL_MARK[st]}
          </i>
        ))}
      </span>
      {last && into - last.at < 90 && <span className="shift-banner-news">{last.text}</span>}
      <button className="button" onClick={onOpen}>
        Shift desk
      </button>
    </div>
  )
}

