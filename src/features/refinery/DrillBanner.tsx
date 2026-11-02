import { useEffect } from 'react'
import { openOverlay } from '../../world/overlay.ts'
import { useGame } from '../../world/store.ts'
import { assessDrill, DRILLS } from './drills.ts'
import { SAFETY_OVERLAY } from './overlayIds.ts'
import { usePlant } from './plant.ts'
import { safety, useSafety } from './safetyStore.ts'
import { clock } from './ui.tsx'
import './Refinery.css'

/**
 * The drill banner across the top of the screen while a drill runs, wherever you are on site. It also referees the
 * drill: escalating it when time runs out and recording the score when it's over.
 */
export function DrillBanner() {
  const run = useSafety((s) => s.drill)
  const time = usePlant((p) => p.furnace.time)
  const overlay = useGame((s) => s.overlay)
  const drill = run && DRILLS.find((d) => d.id === run.id)
  const a = drill && run ? assessDrill(drill, run.taken, time - run.startedAt) : null

  useEffect(() => {
    if (!drill || !run || !a) return
    if (a.status === 'escalated' && !run.escalated) {
      safety.markEscalated()
      drill.escalate?.()
    }
    if ((a.status === 'safe' || a.status === 'recovered') && !run.finished) safety.finishDrill(a.score)
  }, [drill, run, a])

  if (!drill || !run || !a) return null
  const over = a.status === 'safe' || a.status === 'recovered'
  const elapsed = time - run.startedAt
  return (
    <div className={`drill-banner${over ? ' drill-banner-over' : a.status === 'escalated' ? ' drill-banner-late' : ''}`} role="status">
      <strong>{over ? 'Drill over' : 'Drill'}</strong>
      <span className="drill-banner-text">{over ? `${drill.title}: ${a.score} of 100` : drill.alarm}</span>
      {!over && drill.deadline !== null && (
        <span className="drill-banner-clock">
          {clock(elapsed)} / {clock(drill.deadline)}
        </span>
      )}
      {overlay !== SAFETY_OVERLAY && (
        <button className="button" onClick={() => openOverlay(SAFETY_OVERLAY)}>
          {over ? 'Debrief' : 'Respond'}
        </button>
      )}
    </div>
  )
}
