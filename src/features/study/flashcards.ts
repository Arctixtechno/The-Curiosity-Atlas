// Flashcards with spaced repetition, in the style of a Leitner box: every card
// sits in a box, a card you remember moves up a box and comes back later, and
// one you forget goes back to the start. Times are in milliseconds.

export interface Card {
  id: string
  front: string
  back: string
  /** 0 is new or forgotten; 5 is well learned. */
  box: number
  /** When the card is next due. */
  due: number
  reviews: number
}

export interface Deck {
  id: string
  name: string
  cards: Card[]
}

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export const GRADES: { id: Grade; name: string }[] = [
  { id: 'again', name: 'Again' },
  { id: 'hard', name: 'Hard' },
  { id: 'good', name: 'Good' },
  { id: 'easy', name: 'Easy' },
]

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
/** Days until a card in each box comes back. */
export const BOX_DAYS = [0, 1, 3, 7, 16, 35]
export const TOP_BOX = BOX_DAYS.length - 1
/** A forgotten card comes back in the same sitting, this much later. */
const AGAIN_DELAY = MINUTE
/** A card marked hard never comes back sooner than this. */
const HARD_MIN = 10 * MINUTE

export function newCard(id: string, front: string, back: string, now: number): Card {
  return { id, front, back, box: 0, due: now, reviews: 0 }
}

/** The card's box and due time after answering it with `grade`. */
export function review(card: Card, grade: Grade, now: number): Card {
  const reviews = card.reviews + 1
  if (grade === 'again') return { ...card, box: 0, due: now + AGAIN_DELAY, reviews }
  if (grade === 'hard') {
    const box = Math.max(1, card.box)
    return { ...card, box, due: now + Math.max(HARD_MIN, (BOX_DAYS[box] * DAY) / 2), reviews }
  }
  const box = Math.min(TOP_BOX, card.box + (grade === 'easy' ? 2 : 1))
  return { ...card, box, due: now + BOX_DAYS[box] * DAY, reviews }
}

/** How long until the card would come back after `grade`, for the answer buttons. */
export function nextInterval(card: Card, grade: Grade, now: number): string {
  const ms = review(card, grade, now).due - now
  if (ms < 60 * MINUTE) return `${Math.round(ms / MINUTE)} min`
  if (ms < DAY) return `${Math.round(ms / (60 * MINUTE))} h`
  return `${Math.round(ms / DAY)} d`
}

export function dueCards(deck: Deck, now: number): Card[] {
  return deck.cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due)
}

/** How many cards are in each box, for the progress bar. */
export function boxCounts(deck: Deck): number[] {
  const counts = BOX_DAYS.map(() => 0)
  for (const c of deck.cards) counts[Math.min(TOP_BOX, Math.max(0, c.box))]++
  return counts
}

/**
 * Cards pasted as text, one per line, with the question and answer separated
 * by a tab, " - ", " = ", ";" or ":" (the first of those found on the line).
 * Lines without a separator are skipped.
 */
export function parseCards(text: string): { front: string; back: string }[] {
  const separators = ['\t', ' - ', ' – ', ' = ', ';', ':']
  const out: { front: string; back: string }[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const sep = separators.find((s) => line.includes(s))
    if (!sep) continue
    const at = line.indexOf(sep)
    const front = line.slice(0, at).trim()
    const back = line.slice(at + sep.length).trim()
    if (front && back) out.push({ front, back })
  }
  return out
}
