import { useGame } from '../../world/store.ts'
import { useTimer } from './focus.ts'
import { studyTabFromOverlay } from './overlayId.ts'
import { formatClock, PHASE_NAMES, timeLeft } from './timer.ts'
import { useNow } from './useNow.ts'
import './FocusBadge.css'

/** The focus timer's time left, in the corner, while it runs and the study panel is closed. */
export function FocusBadge() {
  const timer = useTimer()
  const overlay = useGame((s) => s.overlay)
  const now = useNow(timer.running)
  if (!timer.running || studyTabFromOverlay(overlay)) return null
  return (
    <div className={`focus-badge focus-badge-${timer.phase}`} role="status" aria-label={`${PHASE_NAMES[timer.phase]} timer`}>
      <span className="focus-badge-dot" aria-hidden="true" />
      {PHASE_NAMES[timer.phase]} · <span className="focus-badge-time">{formatClock(timeLeft(timer, now))}</span>
      {timer.label && timer.phase === 'focus' && <span className="focus-badge-label">{timer.label}</span>}
    </div>
  )
}
