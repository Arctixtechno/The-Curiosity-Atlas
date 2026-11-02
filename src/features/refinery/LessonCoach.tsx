import { useEffect, useState } from 'react'
import { openOverlay } from '../../world/overlay.ts'
import { useGame } from '../../world/store.ts'
import { LESSONS, lessonContext } from './academy.ts'
import { academy, requestAcademyTab, useAcademy } from './academyStore.ts'
import { ACADEMY_OVERLAY } from './overlayIds.ts'
import { usePlant } from './plant.ts'
import './Refinery.css'

/**
 * The lesson coach: a card in the corner that shows the current step of the lesson being run, watches the live plant
 * and ticks each step off when it's met, whichever screen is open.
 */
export function LessonCoach() {
  const active = useAcademy((s) => s.active)
  const index = useAcademy((s) => (s.active ? (s.steps[s.active] ?? 0) : 0))
  const plant = usePlant((p) => p)
  const overlay = useGame((s) => s.overlay)
  const [learned, setLearned] = useState<{ step: number; why: string } | null>(null)
  const [folded, setFolded] = useState(false)

  const lesson = LESSONS.find((l) => l.id === active)
  const step = lesson?.steps[index]

  useEffect(() => {
    if (!lesson || !step || !step.check(lessonContext(plant, overlay))) return
    academy.advance(lesson.id, index, lesson.steps.length)
    setLearned({ step: index, why: step.why })
  }, [lesson, step, index, plant, overlay])

  // What the last step showed stays up long enough to read, then makes room.
  useEffect(() => {
    if (!learned) return
    const t = setTimeout(() => setLearned(null), 12000)
    return () => clearTimeout(t)
  }, [learned])

  // The training centre has the whole lesson on screen already.
  if (!lesson || overlay === ACADEMY_OVERLAY) return null
  const total = lesson.steps.length

  if (folded)
    return (
      <button className="coach coach-folded" onClick={() => setFolded(false)} aria-label={`Show the lesson coach: ${lesson.title}`}>
        <span className="coach-dot" aria-hidden="true" />
        {lesson.title} · {Math.min(index + 1, total)}/{total}
      </button>
    )

  return (
    <aside className="coach" aria-label="Lesson coach" aria-live="polite">
      <div className="coach-head">
        <small>Lesson</small>
        <strong>{lesson.title}</strong>
        <button className="coach-icon" onClick={() => setFolded(true)} aria-label="Fold the coach away" title="Fold away">
          –
        </button>
        <button className="coach-icon" onClick={() => academy.stop()} aria-label="Stop the lesson" title="Stop the lesson">
          ×
        </button>
      </div>
      <div className="coach-track" aria-hidden="true">
        {lesson.steps.map((s, i) => (
          <i key={s.text} className={i < index ? 'done' : i === index ? 'now' : ''} />
        ))}
      </div>
      {learned && (
        <p className="coach-learned" key={learned.step}>
          <span aria-hidden="true">✓</span> {learned.why}
        </p>
      )}
      {step ? (
        <>
          <p className="coach-step">
            <small>
              Step {index + 1} of {total}
            </small>
            {step.text}
          </p>
          <div className="coach-buttons">
            {step.open && overlay !== step.open && (
              <button className="button" onClick={() => openOverlay(step.open!)}>
                Open the screen
              </button>
            )}
            {step.show && (overlay === step.open || !step.open) && (
              <button className="button button-quiet" onClick={() => step.show!()}>
                Show me
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="coach-step coach-finished">
            <small>Lesson complete</small>
            Pass the quiz to earn the certificate.
          </p>
          <div className="coach-buttons">
            <button
              className="button button-primary"
              onClick={() => {
                requestAcademyTab('quizzes')
                openOverlay(ACADEMY_OVERLAY)
              }}
            >
              Take the quiz
            </button>
            <button className="button button-quiet" onClick={() => academy.stop()}>
              Close
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
