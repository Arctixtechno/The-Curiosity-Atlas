import { useState } from 'react'
import { notes, studyView, useNotes, useStudyView } from './data.ts'
import { fileName, noteTitle, searchNotes, wordCount, type Note } from './notes.ts'
import { newId } from './saved.ts'

function createNote() {
  const note: Note = { id: newId(), title: '', body: '', updated: Date.now() }
  notes.set((list) => [note, ...list])
  studyView.set((v) => ({ ...v, note: note.id }))
}

const edit = (id: string, change: Partial<Note>) =>
  notes.set((list) => list.map((n) => (n.id === id ? { ...n, ...change, updated: Date.now() } : n)))

function download(note: Note) {
  const text = `# ${noteTitle(note)}\n\n${note.body}\n`
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName(note)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function when(time: number) {
  const d = new Date(time)
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function NotesTab() {
  const list = useNotes()
  const view = useStudyView()
  const [query, setQuery] = useState('')
  const shown = searchNotes(list, query)
  const open = list.find((n) => n.id === view.note) ?? shown[0]

  if (list.length === 0)
    return (
      <div className="study-empty">
        <p className="muted">
          No notes yet. A good habit: after each focus session, write down the main ideas from memory before you look back at the book.
        </p>
        <button className="button button-primary" onClick={createNote}>
          New note
        </button>
      </div>
    )

  return (
    <div className="study-notes">
      <aside className="study-note-list">
        <div className="study-note-tools">
          <input type="search" placeholder="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search notes" />
          <button className="button" onClick={createNote} title="New note">
            New
          </button>
        </div>
        <ul>
          {shown.map((n) => (
            <li key={n.id}>
              <button
                className={`study-note-item${n.id === open?.id ? ' study-note-open' : ''}`}
                onClick={() => studyView.set((v) => ({ ...v, note: n.id }))}
              >
                <span className="study-note-title">{noteTitle(n)}</span>
                <span className="muted">{when(n.updated)}</span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="muted study-note-none">No notes match.</li>}
        </ul>
      </aside>
      {open ? (
        <div className="study-note-editor">
          <input
            type="text"
            className="study-note-heading"
            placeholder="Title"
            value={open.title}
            onChange={(e) => edit(open.id, { title: e.target.value })}
            aria-label="Note title"
          />
          <textarea
            value={open.body}
            onChange={(e) => edit(open.id, { body: e.target.value })}
            placeholder="Start writing…"
            aria-label="Note"
            spellCheck
          />
          <div className="study-footer">
            <span className="muted">
              {wordCount(open.body)} words · saved {when(open.updated)}
            </span>
            <span className="study-footer-actions">
              <button className="button button-quiet" onClick={() => download(open)}>
                Download
              </button>
              <button
                className="button button-quiet"
                onClick={() => {
                  if (!open.body.trim() || confirm(`Delete "${noteTitle(open)}"?`)) notes.set((l) => l.filter((n) => n.id !== open.id))
                }}
              >
                Delete
              </button>
            </span>
          </div>
        </div>
      ) : (
        <p className="muted">Choose a note.</p>
      )}
    </div>
  )
}
