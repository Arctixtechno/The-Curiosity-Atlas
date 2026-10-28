// Notes: a title, the text, and when it was last changed.

export interface Note {
  id: string
  title: string
  body: string
  updated: number
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/** The note's title, or its first line when it has none. */
export function noteTitle(note: Note): string {
  return note.title.trim() || note.body.trim().split('\n')[0].slice(0, 60) || 'Untitled note'
}

/** Notes matching every word of `query` in their title or text, most recently changed first. */
export function searchNotes(notes: Note[], query: string): Note[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return notes
    .filter((n) => {
      const text = `${n.title}\n${n.body}`.toLowerCase()
      return words.every((w) => text.includes(w))
    })
    .sort((a, b) => b.updated - a.updated)
}

/** A safe file name for downloading a note. */
export function fileName(note: Note): string {
  const base = noteTitle(note)
    .replace(/[^\p{L}\p{N} _-]+/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
  return `${base || 'note'}.md`
}
