import { useEffect, useState, type FormEvent } from 'react'
import { decks, studyView, useDecks, useStudyView } from './data.ts'
import { boxCounts, dueCards, GRADES, newCard, nextInterval, parseCards, review, type Card, type Deck, type Grade } from './flashcards.ts'
import { newId } from './saved.ts'

const changeDeck = (id: string, change: (deck: Deck) => Deck) => decks.set((list) => list.map((d) => (d.id === id ? change(d) : d)))
const changeCard = (deckId: string, card: Card) =>
  changeDeck(deckId, (d) => ({ ...d, cards: d.cards.map((c) => (c.id === card.id ? card : c)) }))

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function until(time: number, now: number) {
  const hours = (time - now) / 3_600_000
  if (hours < 1) return 'in under an hour'
  if (hours < 24) return `in ${Math.round(hours)} hours`
  const days = Math.round(hours / 24)
  return days === 1 ? 'tomorrow' : `in ${days} days`
}

const typing = (e: KeyboardEvent) => e.target instanceof HTMLElement && !!e.target.closest('input, textarea, select')

/** Going through the cards: see the question, think of the answer, turn it over and say how well you knew it. */
function Review({ deck }: { deck: Deck }) {
  const [queue, setQueue] = useState(() => dueCards(deck, Date.now()).map((c) => c.id))
  const [practice, setPractice] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [seen, setSeen] = useState(0)
  const card = deck.cards.find((c) => c.id === queue[0])
  const now = Date.now()

  const answer = (grade: Grade) => {
    if (!card) return
    if (!practice) changeCard(deck.id, review(card, grade, Date.now()))
    setQueue((q) => (grade === 'again' ? [...q.slice(1), q[0]] : q.slice(1)))
    setFlipped(false)
    setSeen((s) => s + 1)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (typing(e) || !card) return
      if ((e.code === 'Space' || e.code === 'Enter') && !flipped) {
        e.preventDefault()
        setFlipped(true)
      } else if (flipped && /^Digit[1-4]$/.test(e.code)) answer(GRADES[Number(e.code.slice(5)) - 1].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  if (deck.cards.length === 0) return <p className="study-empty muted">This deck has no cards yet. Add some under Edit cards.</p>

  if (!card) {
    const next = Math.min(...deck.cards.map((c) => c.due))
    return (
      <div className="study-empty">
        <p>{seen > 0 ? `Well done: ${seen} ${seen === 1 ? 'card' : 'cards'} reviewed.` : 'Nothing due in this deck right now.'}</p>
        <p className="muted">{next > now ? `The next card comes back ${until(next, now)}.` : ''}</p>
        <button
          className="button"
          onClick={() => {
            setPractice(true)
            setQueue(shuffle(deck.cards.map((c) => c.id)))
          }}
        >
          Practise them all anyway
        </button>
        <p className="muted study-hint">Practice doesn't change when cards come back.</p>
      </div>
    )
  }

  return (
    <div className="study-review">
      <p className="muted study-review-count">
        {practice ? 'Practice' : 'Due'}: {queue.length} left
      </p>
      <button className={`study-card${flipped ? ' study-card-flipped' : ''}`} onClick={() => setFlipped(true)} disabled={flipped}>
        <span className="study-card-front">{card.front}</span>
        {flipped ? <span className="study-card-back">{card.back}</span> : <span className="study-card-cue muted">Think of the answer, then click or press Space</span>}
      </button>
      {flipped && (
        <div className="study-grades" role="group" aria-label="How well did you know it?">
          {GRADES.map((g, i) => (
            <button key={g.id} className={`button study-grade study-grade-${g.id}`} onClick={() => answer(g.id)}>
              <span>{g.name}</span>
              <span className="study-grade-when">{practice ? `key ${i + 1}` : nextInterval(card, g.id, now)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CardRow({ deckId, card }: { deckId: string; card: Card }) {
  const [editing, setEditing] = useState(false)
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  if (editing)
    return (
      <li className="study-card-row study-card-row-editing">
        <textarea value={front} onChange={(e) => setFront(e.target.value)} aria-label="Question" rows={2} />
        <textarea value={back} onChange={(e) => setBack(e.target.value)} aria-label="Answer" rows={2} />
        <span className="study-footer-actions">
          <button
            className="button button-primary"
            disabled={!front.trim() || !back.trim()}
            onClick={() => {
              changeCard(deckId, { ...card, front: front.trim(), back: back.trim() })
              setEditing(false)
            }}
          >
            Save
          </button>
          <button className="button button-quiet" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </span>
      </li>
    )
  return (
    <li className="study-card-row">
      <button className="study-card-row-text" onClick={() => setEditing(true)} title="Click to edit">
        <span>{card.front}</span>
        <span className="muted">{card.back}</span>
      </button>
      <span className="study-box" title="Which box the card is in: higher means better learned">
        {card.box === 0 ? 'new' : `box ${card.box}`}
      </span>
      <button
        className="study-icon-button"
        onClick={() => changeDeck(deckId, (d) => ({ ...d, cards: d.cards.filter((c) => c.id !== card.id) }))}
        aria-label="Delete card"
        title="Delete card"
      >
        ×
      </button>
    </li>
  )
}

function EditCards({ deck }: { deck: Deck }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [pasted, setPasted] = useState('')
  const found = parseCards(pasted)

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    changeDeck(deck.id, (d) => ({ ...d, cards: [...d.cards, newCard(newId(), front.trim(), back.trim(), Date.now())] }))
    setFront('')
    setBack('')
  }

  return (
    <div className="study-edit">
      <form className="study-new-card" onSubmit={add}>
        <textarea placeholder="Question" value={front} onChange={(e) => setFront(e.target.value)} rows={2} aria-label="Question" />
        <textarea placeholder="Answer" value={back} onChange={(e) => setBack(e.target.value)} rows={2} aria-label="Answer" />
        <button className="button button-primary" type="submit" disabled={!front.trim() || !back.trim()}>
          Add card
        </button>
      </form>
      <details className="study-import">
        <summary>Paste a list of cards</summary>
        <p className="muted">
          One card per line, with the question and answer separated by a tab (as when copied from a spreadsheet), a dash, an equals sign, a
          semicolon or a colon.
        </p>
        <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={5} placeholder={'Mitochondria - where respiration happens\nH2O = water'} aria-label="Cards to import" />
        <button
          className="button"
          disabled={found.length === 0}
          onClick={() => {
            const now = Date.now()
            changeDeck(deck.id, (d) => ({ ...d, cards: [...d.cards, ...found.map((c) => newCard(newId(), c.front, c.back, now))] }))
            setPasted('')
          }}
        >
          Add {found.length || ''} {found.length === 1 ? 'card' : 'cards'}
        </button>
      </details>
      <ul className="study-card-list">
        {deck.cards.map((c) => (
          <CardRow key={c.id} deckId={deck.id} card={c} />
        ))}
      </ul>
    </div>
  )
}

export function CardsTab() {
  const list = useDecks()
  const view = useStudyView()
  const deck = list.find((d) => d.id === view.deck) ?? list[0]
  const [mode, setMode] = useState<'review' | 'edit'>('review')
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null)
  const [name, setName] = useState('')
  const now = Date.now()

  const choose = (id: string) => studyView.set((v) => ({ ...v, deck: id }))
  const saveName = (e: FormEvent) => {
    e.preventDefault()
    const value = name.trim()
    if (!value) return
    if (naming === 'rename' && deck) changeDeck(deck.id, (d) => ({ ...d, name: value }))
    else {
      const id = newId()
      decks.set((l) => [...l, { id, name: value, cards: [] }])
      choose(id)
      setMode('edit')
    }
    setNaming(null)
  }

  return (
    <div className="study-cards">
      <div className="study-deck-bar">
        {naming ? (
          <form className="study-deck-name" onSubmit={saveName}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Deck name" autoFocus maxLength={60} aria-label="Deck name" />
            <button className="button button-primary" type="submit" disabled={!name.trim()}>
              {naming === 'new' ? 'Create' : 'Rename'}
            </button>
            <button className="button button-quiet" type="button" onClick={() => setNaming(null)}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            {deck && (
              <select value={deck.id} onChange={(e) => choose(e.target.value)} aria-label="Deck">
                {list.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({dueCards(d, now).length} due)
                  </option>
                ))}
              </select>
            )}
            <button
              className="button button-quiet"
              onClick={() => {
                setName('')
                setNaming('new')
              }}
            >
              New deck
            </button>
            {deck && (
              <>
                <button
                  className="button button-quiet"
                  onClick={() => {
                    setName(deck.name)
                    setNaming('rename')
                  }}
                >
                  Rename
                </button>
                <button
                  className="button button-quiet"
                  onClick={() => {
                    if (deck.cards.length === 0 || confirm(`Delete "${deck.name}" and its ${deck.cards.length} cards?`))
                      decks.set((l) => l.filter((d) => d.id !== deck.id))
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </>
        )}
      </div>
      {deck ? (
        <>
          <div className="study-deck-summary">
            <div className="segmented" role="group" aria-label="Review or edit">
              <button className="button" aria-pressed={mode === 'review'} onClick={() => setMode('review')}>
                Review
              </button>
              <button className="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
                Edit cards
              </button>
            </div>
            <Boxes deck={deck} />
          </div>
          {mode === 'review' ? <Review key={deck.id} deck={deck} /> : <EditCards deck={deck} />}
        </>
      ) : (
        <p className="study-empty muted">No decks. Make one to start adding cards.</p>
      )}
    </div>
  )
}

/** How many cards are in each box, from new to well learned. */
function Boxes({ deck }: { deck: Deck }) {
  const counts = boxCounts(deck)
  const total = deck.cards.length || 1
  return (
    <div className="study-boxes" title={`New: ${counts[0]}, boxes 1–5: ${counts.slice(1).join(', ')}`}>
      <div className="study-boxes-bar" aria-hidden="true">
        {counts.map((n, i) => (
          <div key={i} className={`study-boxes-${i}`} style={{ width: `${(n / total) * 100}%` }} />
        ))}
      </div>
      <span className="muted">
        {deck.cards.length} cards · {counts[0]} new · {counts[4] + counts[5]} well learned
      </span>
    </div>
  )
}
