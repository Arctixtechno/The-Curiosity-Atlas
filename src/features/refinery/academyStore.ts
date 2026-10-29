import { useSyncExternalStore } from 'react'

// What a trainee has done in the training centre, kept in this browser. Free
// of the plant and the lessons, so the HUD can ask whether a lesson is running
// without loading the refinery.

export interface NotebookEntry {
  id: number
  /** Wall-clock time it was written, ms. */
  at: number
  /** Simulated plant time, seconds. */
  simTime: number
  note: string
  readings: { label: string; value: string }[]
}

export interface AcademyState {
  /** The lesson being coached, if any. */
  active: string | null
  /** Steps done in each lesson. */
  steps: Record<string, number>
  lessonsDone: string[]
  /** Best quiz score for each topic, out of 1. */
  quiz: Record<string, number>
  /** The name for certificates. */
  name: string
  notebook: NotebookEntry[]
}

const KEY = 'atlas.refinery.academy'
const EMPTY: AcademyState = { active: null, steps: {}, lessonsDone: [], quiz: {}, name: '', notebook: [] }

function load(): AcademyState {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return EMPTY
  }
}

let state = load()
const listeners = new Set<() => void>()

function set(change: Partial<AcademyState>) {
  state = { ...state, ...change }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable; progress then lasts for this visit only.
  }
  listeners.forEach((l) => l())
}

export const getAcademy = () => state

export function useAcademy<T>(selector: (s: AcademyState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
  )
}

export const academy = {
  /** Starts (or restarts) coaching a lesson from its first unfinished step. */
  start(id: string) {
    set({ active: id, steps: { ...state.steps, [id]: state.lessonsDone.includes(id) ? 0 : (state.steps[id] ?? 0) } })
  },
  stop() {
    set({ active: null })
  },
  /** Moves a lesson on from step `from` (once only, however often it's called); finishing the last step completes it. */
  advance(id: string, from: number, total: number) {
    if ((state.steps[id] ?? 0) !== from) return
    const step = from + 1
    const done = step >= total
    set({
      steps: { ...state.steps, [id]: step },
      lessonsDone: done && !state.lessonsDone.includes(id) ? [...state.lessonsDone, id] : state.lessonsDone,
    })
  },
  /** Records a quiz score, keeping the best. */
  score(topic: string, score: number) {
    set({ quiz: { ...state.quiz, [topic]: Math.max(score, state.quiz[topic] ?? 0) } })
  },
  setName(name: string) {
    set({ name: name.slice(0, 60) })
  },
  addNote(entry: Omit<NotebookEntry, 'id'>) {
    const id = Math.max(0, ...state.notebook.map((e) => e.id)) + 1
    set({ notebook: [{ ...entry, id }, ...state.notebook] })
  },
  deleteNote(id: number) {
    set({ notebook: state.notebook.filter((e) => e.id !== id) })
  },
  /** Back to a new trainee. */
  reset() {
    set(EMPTY)
  },
}

export type AcademyTab = 'lessons' | 'quizzes' | 'glossary' | 'certificates' | 'notebook'
let requested: AcademyTab | null = null
/** Asks the training centre to open at a tab, the next time it opens. */
export const requestAcademyTab = (tab: AcademyTab) => (requested = tab)
export function takeAcademyTab(): AcademyTab {
  const tab = requested ?? 'lessons'
  requested = null
  return tab
}
