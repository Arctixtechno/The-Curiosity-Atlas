import { useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { DropIcon } from '../../components/icons.tsx'
import { library, useLibrary } from '../../services/library.ts'
import { openPanel } from '../panels.ts'
import '../FeaturePanels.css'
import './FountainPanel.css'
import { dailyDiscovery, unexpectedDiscovery } from './daily.ts'
import { discoveries } from './discoveries.ts'
import { libraryId, toLibraryItem } from './toLibraryItem.ts'

const searchUrl = (concept: string) => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(concept)}`

const STREAK_KEY = 'atlas.fountainDays'

/** Counts the days in a row the visitor has come to the fountain, counting today. */
function useStreak() {
  const [streak] = useState(() => {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86_400_000).toDateString()
    try {
      const saved = JSON.parse(localStorage.getItem(STREAK_KEY) ?? 'null') as { last: string; days: number } | null
      const days = saved?.last === today ? saved.days : saved?.last === yesterday ? saved.days + 1 : 1
      localStorage.setItem(STREAK_KEY, JSON.stringify({ last: today, days }))
      return days
    } catch {
      return 1
    }
  })
  return streak
}

/**
 * The Discovery Fountain: a question first, with room to guess, then the
 * answer rising like a ripple, more detail, related ideas and saving.
 */
export function FountainPanel() {
  const today = dailyDiscovery(discoveries)
  const [discovery, setDiscovery] = useState(today)
  const [revealed, setRevealed] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [guess, setGuess] = useState('')
  const saved = useLibrary().some((i) => i.id === libraryId(discovery))
  const isToday = discovery.id === today.id
  const streak = useStreak()

  const show = (next: typeof discovery) => {
    setDiscovery(next)
    setRevealed(false)
    setShowMore(false)
    setGuess('')
  }

  return (
    <Panel title="Discovery Fountain" subtitle="A new question rises every day" icon={<DropIcon />}>
      <div className="feature-panel fountain">
        <div className="fountain-meta">
          <span className="topic-chip">{discovery.topic}</span>
          <span className="panel-kicker">{isToday ? "Today's discovery" : 'Something unexpected'}</span>
          {streak > 1 && (
            <span className="streak" title="Days in a row you've visited the fountain">
              {streak} days in a row
            </span>
          )}
        </div>
        <h2 className="discovery-question" key={discovery.id}>
          {discovery.question}
        </h2>

        {!revealed ? (
          <form
            className="guess"
            onSubmit={(e) => {
              e.preventDefault()
              setRevealed(true)
            }}
          >
            <label className="muted" htmlFor="fountain-guess">
              Have a guess first: it makes the answer stick.
            </label>
            <div className="guess-row">
              <input
                id="fountain-guess"
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Your guess (optional)"
                autoComplete="off"
                maxLength={140}
                autoFocus
              />
              <button className="primary" type="submit">
                Reveal the answer
              </button>
            </div>
          </form>
        ) : (
          <div className="discovery-answer">
            {guess.trim() && <p className="your-guess">You guessed: “{guess.trim()}”</p>}
            <p className="answer">{discovery.answer}</p>
            <p>{discovery.explanation}</p>
            {showMore && <p className="more">{discovery.more}</p>}

            <div className="related">
              <span>Explore related ideas</span>
              {discovery.related.map((concept) => (
                <a key={concept} className="related-chip" href={searchUrl(concept)} target="_blank" rel="noreferrer">
                  {concept} ↗
                </a>
              ))}
            </div>
            <p className="source">
              Source:{' '}
              <a href={discovery.source.url} target="_blank" rel="noreferrer">
                {discovery.source.title}
              </a>
            </p>

            <div className="panel-actions">
              {!showMore && <button onClick={() => setShowMore(true)}>Tell me more</button>}
              <button
                className={saved ? 'saved' : 'primary'}
                onClick={() => (saved ? library.remove(libraryId(discovery)) : library.save(toLibraryItem(discovery)))}
                aria-pressed={saved}
              >
                {saved ? '✓ Saved to Library' : 'Save to Library'}
              </button>
            </div>
          </div>
        )}

        <div className="panel-footer">
          <button onClick={() => show(unexpectedDiscovery(discoveries, discovery))}>Surprise me</button>
          {!isToday && <button onClick={() => show(today)}>Back to today's</button>}
          <button className="link" onClick={() => openPanel('library')}>
            Open my Library
          </button>
        </div>
      </div>
    </Panel>
  )
}
