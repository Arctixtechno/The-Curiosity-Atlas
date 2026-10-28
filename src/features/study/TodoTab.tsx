import { useState, type FormEvent } from 'react'
import { CloseIcon, TimerIcon } from '../../components/icons.tsx'
import { todos, useTodos } from './data.ts'
import { focusOn } from './focus.ts'
import { dayKey, newId } from './saved.ts'
import { describeDue, sortTodos, type Todo } from './todos.ts'

const update = (id: string, change: Partial<Todo>) => todos.set((list) => list.map((t) => (t.id === id ? { ...t, ...change } : t)))
const remove = (id: string) => todos.set((list) => list.filter((t) => t.id !== id))

function TodoRow({ todo, today, onFocus }: { todo: Todo; today: string; onFocus: () => void }) {
  const [editing, setEditing] = useState(false)
  const due = todo.due ? describeDue(todo.due, today) : null
  return (
    <li className={`study-todo${todo.done ? ' study-todo-done' : ''}`}>
      <input type="checkbox" checked={todo.done} onChange={(e) => update(todo.id, { done: e.target.checked })} aria-label={`Done: ${todo.text}`} />
      {editing ? (
        <input
          type="text"
          className="study-todo-edit"
          defaultValue={todo.text}
          autoFocus
          onBlur={(e) => {
            const text = e.target.value.trim()
            if (text) update(todo.id, { text })
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              // Leave editing without closing the panel.
              e.stopPropagation()
              setEditing(false)
            }
          }}
        />
      ) : (
        <button className="study-todo-text" onClick={() => setEditing(true)} title="Click to edit">
          {todo.text}
        </button>
      )}
      {due && !todo.done && <span className={`study-due study-due-${due.tone}`}>{due.text}</span>}
      {!todo.done && (
        <button
          className="study-icon-button"
          onClick={() => {
            focusOn(todo.text)
            onFocus()
          }}
          title="Start a focus session on this"
          aria-label={`Focus on ${todo.text}`}
        >
          <TimerIcon size={16} />
        </button>
      )}
      <button className="study-icon-button" onClick={() => remove(todo.id)} title="Delete" aria-label={`Delete ${todo.text}`}>
        <CloseIcon size={16} />
      </button>
    </li>
  )
}

export function TodoTab({ onFocus }: { onFocus: () => void }) {
  const list = useTodos()
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const today = dayKey()
  const sorted = sortTodos(list)
  const left = list.filter((t) => !t.done).length
  const done = list.length - left

  const add = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    todos.set((l) => [...l, { id: newId(), text: value, done: false, due: due || undefined, created: Date.now() }])
    setText('')
    setDue('')
  }

  return (
    <div className="study-todos">
      <form className="study-add" onSubmit={add}>
        <input type="text" placeholder="Add a task, like 'Revise chapter 4'" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} aria-label="New task" />
        <label className="study-date">
          <span className="muted">Due</span>
          <input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} aria-label="Due date (optional)" />
        </label>
        <button className="button button-primary" type="submit" disabled={!text.trim()}>
          Add
        </button>
      </form>
      {sorted.length === 0 ? (
        <p className="study-empty muted">
          Nothing on the list yet. Break big jobs into small tasks you could finish in one or two focus sessions.
        </p>
      ) : (
        <ul className="study-todo-list">
          {sorted.map((t) => (
            <TodoRow key={t.id} todo={t} today={today} onFocus={onFocus} />
          ))}
        </ul>
      )}
      {list.length > 0 && (
        <div className="study-footer">
          <span className="muted">
            {left} to do · {done} done
          </span>
          {done > 0 && (
            <button className="button button-quiet" onClick={() => todos.set((l) => l.filter((t) => !t.done))}>
              Clear finished
            </button>
          )}
        </div>
      )}
    </div>
  )
}
