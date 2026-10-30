import { useMemo, useState } from 'react'
import { closeOverlay } from '../../world/overlay.ts'
import { Panel } from '../../components/Panel.tsx'
import { RoundsIcon } from './icons.tsx'
import { getPlant } from './plant.ts'
import { CHECKPOINTS, faultsFor, scoreRound, type Checkpoint, type RoundCall } from './rounds.ts'
import { rounds, useRounds, type RoundState } from './roundStore.ts'
import { getSafety } from './safetyStore.ts'
import './Refinery.css'

/** The operator's round sheet: start a round, take each checkpoint's readings, and hand the sheet in. */
export function RoundsPanel() {
  const state = useRounds((s) => s)
  const at = state.active && state.at ? CHECKPOINTS.find((c) => c.id === state.at) : undefined
  return (
    <Panel title="Operator rounds" subtitle="Walk the site, take the readings, and report what isn’t right" icon={<RoundsIcon />} wide>
      <div className="cdu rd">
        {!state.active ? (
          <Start state={state} />
        ) : at && !state.active.calls[at.id] ? (
          <TakeReading key={at.id} checkpoint={at} number={state.active.number} />
        ) : (
          <Sheet state={state} justDone={at} />
        )}
      </div>
    </Panel>
  )
}

function Start({ state }: { state: RoundState }) {
  return (
    <>
      <p>
        Twice a shift a field operator walks the plant with a round sheet: listening to pumps, looking through peepholes, reading gauges no transmitter
        reads. Most problems are found this way long before an alarm. Some of what you find will be planted for the round; some will be how the plant is
        really running.
      </p>
      <ol className="rd-list">
        {CHECKPOINTS.map((c) => (
          <li key={c.id}>
            <strong>{c.name}</strong>
            <small>{c.check}</small>
          </li>
        ))}
      </ol>
      <div className="sf-test">
        <span className="muted">{state.best > 0 ? `Best round: ${state.best} of ${CHECKPOINTS.length} calls right.` : 'The checkpoints are the yellow posts round the site.'}</span>
        <button
          className="button button-primary"
          onClick={() => {
            rounds.start()
            closeOverlay()
          }}
        >
          Start round {state.count + 1}
        </button>
      </div>
    </>
  )
}

function TakeReading({ checkpoint, number }: { checkpoint: Checkpoint; number: number }) {
  // Read once, when you arrive: the gauges are what they are at that moment.
  const reading = useMemo(() => checkpoint.read(getPlant(), faultsFor(number), getSafety()), [checkpoint, number])
  const [call, setCall] = useState<RoundCall['call'] | null>(null)
  const right = call !== null && (call === 'report') === reading.abnormal
  return (
    <div className="rd-reading">
      <small className="muted">Checkpoint</small>
      <h3>{checkpoint.name}</h3>
      <p className="muted">Check: {checkpoint.check}</p>
      <dl className="sf-detector rd-gauges">
        {reading.lines.map((l) => (
          <div key={l.label}>
            <dt>{l.label}</dt>
            <dd>{l.value}</dd>
          </div>
        ))}
      </dl>
      {call === null ? (
        <div className="ac-buttons rd-calls">
          <button className="button" onClick={() => setCall('normal')}>
            All normal
          </button>
          <button className="button button-primary" onClick={() => setCall('report')}>
            Report a fault
          </button>
        </div>
      ) : (
        <div className={`ac-why ${right ? 'ac-why-right' : 'ac-why-wrong'}`} role="status">
          <strong>{right ? 'Good call.' : reading.abnormal ? 'This needed reporting.' : 'This one was fine.'}</strong> {reading.finding}
          <div className="ac-buttons">
            <button
              className="button button-primary"
              onClick={() => {
                rounds.call(checkpoint.id, { call, reading })
                rounds.arrive(null)
                closeOverlay()
              }}
            >
              On to the next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Sheet({ state, justDone }: { state: RoundState; justDone?: Checkpoint }) {
  const calls = state.active!.calls
  const score = scoreRound(calls)
  const complete = score.checked === score.total
  return (
    <>
      {justDone && <p className="cdu-note">You’ve already taken the readings at {justDone.name}.</p>}
      <div className="rd-sheet">
        <div className="rd-sheet-head">
          <strong>Round sheet · round {state.active!.number}</strong>
          <span>
            {score.checked} of {score.total} checked
          </span>
        </div>
        <ol>
          {CHECKPOINTS.map((c) => {
            const call = calls[c.id]
            const right = call && (call.call === 'report') === call.reading.abnormal
            return (
              <li key={c.id} className={!call ? '' : complete ? (right ? 'rd-right' : 'rd-wrong') : 'rd-done'}>
                <span className="rd-box" aria-hidden="true">
                  {call ? (complete ? (right ? '✓' : '✗') : '•') : ''}
                </span>
                <span>
                  <strong>{c.name}</strong>
                  <small>{call ? `${call.call === 'report' ? 'Reported' : 'Normal'}${complete ? `: ${call.reading.finding}` : ''}` : c.check}</small>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="sf-test">
        {complete ? (
          <span>
            <strong>
              {score.right} of {score.total}
            </strong>{' '}
            calls right.{' '}
            {score.wrong.length === 0 ? 'A clean round: nothing missed, nothing reported for nothing.' : `Look again at ${score.wrong.map((c) => c.name.split(',')[0]).join(', ')}.`}
          </span>
        ) : (
          <span className="muted">Walk to the next yellow post and press E to take its readings.</span>
        )}
        <div className="ac-buttons">
          {!complete && (
            <button className="button button-quiet" onClick={() => rounds.abandon()}>
              Abandon the round
            </button>
          )}
          {complete ? (
            <button className="button button-primary" onClick={() => rounds.finish(score.right)}>
              Hand in the sheet
            </button>
          ) : (
            <button className="button button-primary" onClick={closeOverlay}>
              Carry on walking
            </button>
          )}
        </div>
      </div>
    </>
  )
}
