import { beforeEach, describe, expect, it } from 'vitest'
import { GLOSSARY, LESSONS, lessonContext, readings, searchGlossary, TOPICS } from './academy.ts'
import { academy, getAcademy } from './academyStore.ts'
import { advancePlant, controls, getPlant } from './plant.ts'

beforeEach(() => {
  controls.reset()
  academy.reset()
})

describe('lessons', () => {
  it.each(LESSONS.map((l) => [l.id, l] as const))('%s can be finished with the Show me buttons', (_, lesson) => {
    for (const [i, step] of lesson.steps.entries()) {
      // A step that only asks for a screen is met when that screen is open.
      const overlay = step.open ?? null
      if (!step.check(lessonContext(getPlant(), overlay))) {
        if (step.check === undefined || !step.show) throw new Error(`step ${i} has no way to show it`)
        if (overlay === null || !step.text.startsWith('Open')) step.show()
        for (let s = 0; s < 120 && !step.check(lessonContext(getPlant(), overlay)); s++) advancePlant(1)
      }
      expect(step.check(lessonContext(getPlant(), overlay)), `${lesson.id} step ${i}: ${step.text}`).toBe(true)
    }
  })

  it('every lesson has a quiz', () => {
    for (const l of LESSONS) expect(TOPICS.some((t) => t.id === l.topic)).toBe(true)
  })

  it('records progress and finishes a lesson on its last step', () => {
    academy.start('crude')
    expect(getAcademy().active).toBe('crude')
    const total = LESSONS[0].steps.length
    for (let i = 0; i < total; i++) academy.advance('crude', i, total)
    academy.advance('crude', 0, total)
    expect(getAcademy().steps.crude).toBe(total)
    expect(getAcademy().lessonsDone).toContain('crude')
    academy.start('crude')
    expect(getAcademy().steps.crude).toBe(0)
  })
})

describe('quizzes', () => {
  it('have well-formed questions', () => {
    for (const t of TOPICS) {
      expect(t.questions.length).toBe(5)
      for (const q of t.questions) {
        expect(q.options.length).toBeGreaterThanOrEqual(3)
        expect(q.answer).toBeGreaterThanOrEqual(0)
        expect(q.answer).toBeLessThan(q.options.length)
        expect(new Set(q.options).size).toBe(q.options.length)
      }
    }
  })

  it('keep the best score', () => {
    academy.score('crude', 0.8)
    academy.score('crude', 0.4)
    expect(getAcademy().quiz.crude).toBe(0.8)
  })
})

describe('glossary and notebook', () => {
  it('has sixty-odd terms, A to Z, none repeated', () => {
    const terms = GLOSSARY.map((t) => t.term)
    expect(new Set(terms).size).toBe(terms.length)
    expect(terms.length).toBeGreaterThanOrEqual(60)
    expect([...terms].sort((a, b) => a.localeCompare(b))).toEqual(terms)
  })

  it('finds terms before meanings', () => {
    const hits = searchGlossary('octane')
    expect(hits[0].term).toBe('Octane')
    expect(hits.some((t) => t.term === 'RON')).toBe(true)
  })

  it('takes a snapshot of the plant and keeps notes newest first', () => {
    expect(readings(getPlant()).length).toBe(8)
    academy.addNote({ at: 1, simTime: 0, note: 'first', readings: [] })
    academy.addNote({ at: 2, simTime: 0, note: 'second', readings: [] })
    expect(getAcademy().notebook.map((e) => e.note)).toEqual(['second', 'first'])
    academy.deleteNote(getAcademy().notebook[0].id)
    expect(getAcademy().notebook.map((e) => e.note)).toEqual(['first'])
  })
})
