import { useEffect, useRef, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { openOverlay } from '../../world/overlay.ts'
import { useAcademy } from './academyStore.ts'
import { medals, rankOf, RANKS, type Medal, type Tier } from './career.ts'
import { useCompleted } from './challenges.ts'
import { LogbookIcon } from './icons.tsx'
import { LOGBOOK_OVERLAY } from './overlayIds.ts'
import { useRounds } from './roundStore.ts'
import { useSafety } from './safetyStore.ts'
import { useShifts } from './shiftStore.ts'
import './Refinery.css'

const TIER_TEXT: Record<Tier, string> = { none: 'Not yet', bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }

/** The medals as they stand, kept up to date from every store they're earned in. */
export function useMedals() {
  const tasksDone = useCompleted()
  const academy = useAcademy((s) => s)
  const safety = useSafety((s) => s)
  const roundBest = useRounds((s) => s.best)
  const shiftBest = useShifts((s) => s.best)
  return { list: medals({ tasksDone, lessonsDone: academy.lessonsDone, quiz: academy.quiz, drillBest: safety.best, permits: safety.permits, roundBest, shiftBest }), name: academy.name }
}

const SEEN_KEY = 'curiosity-atlas:refinery:medals-seen:v1'

/** A card that rises when a medal is won or goes up a tier, wherever you are on site. */
export function MedalWatcher() {
  const { list } = useMedals()
  const [shown, setShown] = useState<Medal | null>(null)
  const seen = useRef<Record<string, Tier> | null>(null)
  useEffect(() => {
    if (!seen.current) {
      try {
        seen.current = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null')
      } catch {
        seen.current = null
      }
      // The first time, what's already been earned is taken as seen.
      if (!seen.current) seen.current = Object.fromEntries(list.map((m) => [m.id, m.tier]))
    }
    const order: Tier[] = ['none', 'bronze', 'silver', 'gold']
    const won = list.find((m) => order.indexOf(m.tier) > order.indexOf(seen.current![m.id] ?? 'none'))
    seen.current = Object.fromEntries(list.map((m) => [m.id, m.tier]))
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen.current))
    } catch {
      // Not kept: the card may show again next visit.
    }
    if (won) setShown(won)
    // Only when a tier changes, not on every render.
  }, [list.map((m) => m.tier).join()])
  useEffect(() => {
    if (!shown) return
    const timer = setTimeout(() => setShown(null), 6000)
    return () => clearTimeout(timer)
  }, [shown])
  if (!shown) return null
  return (
    <button className={`medal-toast lgb-${shown.tier}`} onClick={() => openOverlay(LOGBOOK_OVERLAY)} role="status">
      <svg viewBox="0 0 48 60" aria-hidden="true">
        <path d="M14 2h8l4 14-6 4zM34 2h-8l-4 14 6 4z" className="lgb-ribbon" />
        <circle cx="24" cy="36" r="16" className="lgb-disc" />
      </svg>
      <span>
        <small>{TIER_TEXT[shown.tier]} medal</small>
        <strong>{shown.title}</strong>
      </span>
    </button>
  )
}

/** The operator's logbook: medals for everything done across the refinery, and the rank they add up to. */
export function LogbookPanel() {
  const { list, name } = useMedals()
  const { points, max, rank, next } = rankOf(list)
  const from = rank.points
  const to = next?.points ?? max
  return (
    <Panel title="Operator’s logbook" subtitle="Everything you’ve done at Marshgate, and what to go for next" icon={<LogbookIcon />} wide>
      <div className="cdu lgb">
        <section className="lgb-rank">
          <div className="lgb-badge" aria-hidden="true">
            {RANKS.indexOf(rank) + 1}
          </div>
          <div>
            <small className="muted">{name ? `${name}, ` : ''}Marshgate Refinery</small>
            <h3>{rank.title}</h3>
            <div className="lgb-bar" aria-label={`${points} of ${max} points`}>
              <i style={{ width: `${next ? ((points - from) / (to - from)) * 100 : 100}%` }} />
            </div>
            <p className="muted">
              {next ? `${points} points · ${next.points - points} more to ${next.title.toLowerCase()}` : `${points} points: every medal at gold. The site is yours.`}
            </p>
          </div>
        </section>
        <div className="lgb-medals">
          {list.map((m) => (
            <MedalCard key={m.id} medal={m} />
          ))}
        </div>
        <p className="cdu-note">A medal’s bronze, silver and gold each count a point towards your rank. Progress is kept in this browser.</p>
      </div>
    </Panel>
  )
}

function MedalCard({ medal: m }: { medal: Medal }) {
  const nextStep = m.steps.find((s) => m.have < s)
  return (
    <article className={`lgb-medal lgb-${m.tier}`}>
      <svg viewBox="0 0 48 60" aria-hidden="true">
        <path d="M14 2h8l4 14-6 4zM34 2h-8l-4 14 6 4z" className="lgb-ribbon" />
        <circle cx="24" cy="36" r="16" className="lgb-disc" />
        <circle cx="24" cy="36" r="11.5" className="lgb-inner" />
        <text x="24" y="41" textAnchor="middle">
          {m.tier === 'none' ? '' : m.tier === 'gold' ? '★' : m.tier === 'silver' ? 'II' : 'I'}
        </text>
      </svg>
      <div>
        <h4>{m.title}</h4>
        <p>{m.text}</p>
        <div className="lgb-steps" aria-label={`${m.have} of ${m.of}`}>
          {m.steps.map((s, i) => (
            <span key={i} className={m.have >= s ? 'done' : ''}>
              {s}
            </span>
          ))}
        </div>
        <small className="muted">
          {TIER_TEXT[m.tier]} · {m.have} of {m.of}
          {nextStep !== undefined && ` · ${nextStep - m.have} to the next`}
        </small>
      </div>
      {m.tier !== 'gold' && (
        <button className="button button-quiet" onClick={() => openOverlay(m.overlay)}>
          Go for it
        </button>
      )}
    </article>
  )
}
