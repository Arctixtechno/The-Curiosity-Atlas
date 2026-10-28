import type { Deck } from './flashcards.ts'
import type { Note } from './notes.ts'
import { saved, useSaved } from './saved.ts'
import { STARTER_DECKS } from './starterDecks.ts'
import type { Todo } from './todos.ts'

// Everything the study tools keep, in this browser only.

export const todos = saved<Todo[]>('atlas.study.todos', [])
export const notes = saved<Note[]>('atlas.study.notes', [])
export const decks = saved<Deck[]>('atlas.study.decks', STARTER_DECKS)
/** The deck and note last open in the study panel. */
export const studyView = saved<{ deck?: string; note?: string }>('atlas.study.view', {})

export const useTodos = () => useSaved(todos)
export const useNotes = () => useSaved(notes)
export const useDecks = () => useSaved(decks)
export const useStudyView = () => useSaved(studyView)
