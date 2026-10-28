import { describe, expect, it } from 'vitest'
import { dueCards, newCard, parseCards, review, type Deck } from './flashcards.ts'
import { fileName, noteTitle, searchNotes, wordCount } from './notes.ts'
import { advance, DEFAULT_TIMER_SETTINGS, formatClock, initialTimer, pause, start, timeLeft } from './timer.ts'
import { daysUntil, describeDue, sortTodos, type Todo } from './todos.ts'

const MIN = 60_000
const DAY = 24 * 60 * MIN

describe('focus timer', () => {
  const settings = DEFAULT_TIMER_SETTINGS

  it('counts down while running and holds still while paused', () => {
    let t = start(initialTimer(settings), 0)
    expect(timeLeft(t, 10 * MIN)).toBe(15 * MIN)
    t = pause(t, 10 * MIN)
    expect(timeLeft(t, 60 * MIN)).toBe(15 * MIN)
    t = start(t, 60 * MIN)
    expect(timeLeft(t, 70 * MIN)).toBe(5 * MIN)
    expect(timeLeft(t, 99 * MIN)).toBe(0)
  })

  it('takes a short break after each focus session and a long one after every fourth', () => {
    let t = initialTimer(settings)
    const phases: string[] = []
    for (let i = 0; i < 8; i++) {
      t = advance(t, settings, 0)
      phases.push(t.phase)
    }
    expect(phases).toEqual(['short', 'focus', 'short', 'focus', 'short', 'focus', 'long', 'focus'])
    expect(t.done).toBe(0)
  })

  it("doesn't count a skipped focus session", () => {
    const t = advance(initialTimer(settings), settings, 0, false)
    expect(t.phase).toBe('short')
    expect(t.done).toBe(0)
  })

  it('starts the next phase straight away only when asked to', () => {
    expect(advance(initialTimer(settings), settings, 0).running).toBe(false)
    const auto = advance(initialTimer(settings), { ...settings, autoStart: true }, 1000)
    expect(auto.running).toBe(true)
    expect(auto.endsAt).toBe(1000 + 5 * MIN)
  })

  it('shows minutes and seconds, rounding up so it reads 0:00 only at the end', () => {
    expect(formatClock(25 * MIN)).toBe('25:00')
    expect(formatClock(61_500)).toBe('1:02')
    expect(formatClock(200)).toBe('0:01')
    expect(formatClock(0)).toBe('0:00')
  })
})

describe('flashcards', () => {
  const card = newCard('a', 'Q', 'A', 0)

  it('moves a remembered card up a box and brings it back later each time', () => {
    const once = review(card, 'good', 0)
    expect(once.box).toBe(1)
    expect(once.due).toBe(DAY)
    const twice = review(once, 'good', DAY)
    expect(twice.box).toBe(2)
    expect(twice.due).toBe(DAY + 3 * DAY)
  })

  it('sends a forgotten card back to the start, to see again in this sitting', () => {
    const learned = { ...card, box: 4 }
    const forgotten = review(learned, 'again', 0)
    expect(forgotten.box).toBe(0)
    expect(forgotten.due).toBe(MIN)
  })

  it('jumps two boxes for an easy card, never past the top', () => {
    expect(review(card, 'easy', 0).box).toBe(2)
    expect(review({ ...card, box: 5 }, 'easy', 0).box).toBe(5)
  })

  it('keeps a hard card in its box and brings it back sooner', () => {
    const hard = review({ ...card, box: 3 }, 'hard', 0)
    expect(hard.box).toBe(3)
    expect(hard.due).toBe(3.5 * DAY)
    expect(review(card, 'hard', 0).due).toBe(DAY / 2)
  })

  it('lists due cards, longest waiting first', () => {
    const deck: Deck = {
      id: 'd',
      name: 'D',
      cards: [
        { ...card, id: 'later', due: 5 * DAY },
        { ...card, id: 'b', due: 2 },
        { ...card, id: 'a', due: 1 },
      ],
    }
    expect(dueCards(deck, DAY).map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('reads pasted cards with any of the usual separators', () => {
    expect(
      parseCards('H2O\twater\nNaCl - salt\n\nno separator here\nAu = gold\npi; 3.14159\nThe answer: 42\nx:  '),
    ).toEqual([
      { front: 'H2O', back: 'water' },
      { front: 'NaCl', back: 'salt' },
      { front: 'Au', back: 'gold' },
      { front: 'pi', back: '3.14159' },
      { front: 'The answer', back: '42' },
    ])
  })
})

describe('to-do list', () => {
  const todo = (id: string, done: boolean, due?: string, created = 0): Todo => ({ id, text: id, done, due, created })

  it('puts open tasks first, soonest deadline at the top', () => {
    const sorted = sortTodos([
      todo('done', true, '2026-01-01'),
      todo('none', false),
      todo('later', false, '2026-03-01'),
      todo('soon', false, '2026-02-01'),
    ])
    expect(sorted.map((t) => t.id)).toEqual(['soon', 'later', 'none', 'done'])
  })

  it('counts whole days to a deadline, across a clock change', () => {
    expect(daysUntil('2026-10-26', '2026-10-24')).toBe(2)
    expect(daysUntil('2026-03-30', '2026-03-28')).toBe(2)
    expect(describeDue('2026-10-24', '2026-10-26')).toEqual({ text: '2 days late', tone: 'late' })
    expect(describeDue('2026-10-27', '2026-10-26').text).toBe('due tomorrow')
  })
})

describe('notes', () => {
  const note = (id: string, title: string, body: string, updated = 0) => ({ id, title, body, updated })

  it('counts words', () => {
    expect(wordCount('  one two\nthree  ')).toBe(3)
    expect(wordCount('   ')).toBe(0)
  })

  it('uses the first line as the title when there is none', () => {
    expect(noteTitle(note('a', '', 'Photosynthesis\nLight in, sugar out'))).toBe('Photosynthesis')
    expect(noteTitle(note('a', '', ''))).toBe('Untitled note')
  })

  it('finds notes containing every word searched for, newest first', () => {
    const notes = [note('a', 'Cells', 'mitochondria make ATP', 1), note('b', 'Energy', 'ATP and mitochondria', 2), note('c', 'x', 'ATP', 3)]
    expect(searchNotes(notes, 'atp MITO').map((n) => n.id)).toEqual(['b', 'a'])
  })

  it('makes a safe file name', () => {
    expect(fileName(note('a', 'Week 3: Thermo / Gas laws!', ''))).toBe('week-3-thermo-gas-laws.md')
  })
})
