import { useState } from 'react'
import { library, useLibrary } from '../../services/library.ts'
import { openPanel } from '../panels.ts'
import { dailyDiscovery, unexpectedDiscovery } from './daily.ts'
import { discoveries } from './discoveries.ts'
import { libraryId, toLibraryItem } from './toLibraryItem.ts'

const searchUrl = (concept: string) =>
  `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(concept)}`

/** The Discovery Fountain: a question first, then the answer, more detail, related ideas and saving. */
export function FountainPanel() {
  const today = dailyDiscovery(discoveries)
  const [discovery, setDiscovery] = useState(today)
  const [revealed, setRevealed] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const saved = useLibrary().some((i) => i.id === libraryId(discovery))
  const isToday = discovery.id === today.id

  const show = (next: typeof discovery) => {
    setDiscovery(next)
    setRevealed(false)
    setShowMore(false)
  }

  return (
    <>
      <p className="panel-kicker">
        {isToday ? "Today's discovery" : 'Something unexpected'} · {discovery.topic}
      </p>
      <h2 className="discovery-question">{discovery.question}</h2>

      {!revealed ? (
        <div className="panel-actions">
          <button className="primary" onClick={() => setRevealed(true)} autoFocus>
            Reveal the answer
          </button>
        </div>
      ) : (
        <div className="discovery-answer">
          <p className="answer">{discovery.answer}</p>
          <p>{discovery.explanation}</p>
          {showMore && <p>{discovery.more}</p>}

          <div className="related">
            <span>Explore related ideas:</span>
            {discovery.related.map((concept) => (
              <a key={concept} href={searchUrl(concept)} target="_blank" rel="noreferrer">
                {concept}
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
    </>
  )
}
