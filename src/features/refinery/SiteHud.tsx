import { useEffect } from 'react'
import { openOverlay } from '../../world/overlay.ts'
import { gameStore, useGame } from '../../world/store.ts'
import { ROUNDS_OVERLAY } from './overlayIds.ts'
import { CHECKPOINTS } from './rounds.ts'
import { useRounds } from './roundStore.ts'
import { tour, TOUR, useTourStop, yawTowards } from './tour.ts'
import './Refinery.css'

// What the refinery puts on screen while you walk the site: the round sheet's
// progress, and the tour's caption card.

/** The operator's round in the corner: how far through, and the next checkpoint. */
export function RoundChip() {
  const active = useRounds((s) => s.active)
  if (!active) return null
  const done = CHECKPOINTS.filter((c) => active.calls[c.id]).length
  const next = CHECKPOINTS.find((c) => !active.calls[c.id])
  return (
    <button className="round-chip" onClick={() => openOverlay(ROUNDS_OVERLAY)}>
      <strong>Round {active.number}</strong>
      <span className="round-dots" aria-hidden="true">
        {CHECKPOINTS.map((c) => (
          <i key={c.id} className={active.calls[c.id] ? 'done' : ''} />
        ))}
      </span>
      <span>{next ? `${done} of ${CHECKPOINTS.length} · next: ${next.name.split(',')[0]}` : 'All checked: hand in the sheet'}</span>
    </button>
  )
}

/** Puts the player at a tour stop, facing what it's about. */
function standAt(index: number) {
  const s = TOUR[index]
  gameStore.set({ isExploring: true, arrival: { position: [s.at[0], 1.65, s.at[1]], yaw: yawTowards(s.at, s.look) } })
}

/** The tour's caption card, with the keys to move on. */
export function TourCard() {
  const index = useTourStop()
  const overlay = useGame((s) => s.overlay)

  useEffect(() => {
    if (index !== null) standAt(index)
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (index === null || gameStore.get().overlay || e.repeat) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return
      if (e.code === 'KeyT') tour.go(e.shiftKey ? index - 1 : index + 1 < TOUR.length ? index + 1 : null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index])

  if (index === null || overlay) return null
  const stop = TOUR[index]
  const last = index === TOUR.length - 1
  return (
    <aside className="tour-card" aria-label="Site tour" aria-live="polite">
      <div className="coach-head">
        <small>
          Tour · {index + 1} of {TOUR.length}
        </small>
        <strong>{stop.title}</strong>
        <button className="coach-icon" onClick={() => tour.go(null)} aria-label="End the tour" title="End the tour">
          ×
        </button>
      </div>
      <div className="coach-track" aria-hidden="true">
        {TOUR.map((s, i) => (
          <i key={s.title} className={i < index ? 'done' : i === index ? 'now' : ''} />
        ))}
      </div>
      <p className="coach-step">{stop.text}</p>
      <div className="coach-buttons">
        <button className="button button-quiet" onClick={() => tour.go(index - 1)} disabled={index === 0}>
          Back
        </button>
        {stop.overlay && (
          <button className="button" onClick={() => openOverlay(stop.overlay!)}>
            Open its screen
          </button>
        )}
        <button className="button button-primary" onClick={() => tour.go(last ? null : index + 1)}>
          {last ? 'Finish' : 'Next stop'}
        </button>
      </div>
      <p className="tour-keys">
        <kbd>T</kbd> next stop · <kbd>Shift</kbd>+<kbd>T</kbd> back · <kbd>Esc</kbd> frees the mouse to click the buttons
      </p>
    </aside>
  )
}
