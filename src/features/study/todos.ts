// The to-do list: tasks with an optional date they're due.

export interface Todo {
  id: string
  text: string
  done: boolean
  /** YYYY-MM-DD, if the task has a deadline. */
  due?: string
  created: number
}

/** Tasks still to do first, the soonest deadline at the top, then tasks without one, then finished tasks. */
export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.due !== b.due) {
      if (!a.due) return 1
      if (!b.due) return -1
      return a.due < b.due ? -1 : 1
    }
    return a.created - b.created
  })
}

/** Whole days from `today` to `due`, both YYYY-MM-DD: 0 is today, negative is late. */
export function daysUntil(due: string, today: string): number {
  const toUtc = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, day)
  }
  return Math.round((toUtc(due) - toUtc(today)) / 86_400_000)
}

export function describeDue(due: string, today: string): { text: string; tone: 'late' | 'soon' | 'later' } {
  const days = daysUntil(due, today)
  if (days < 0) return { text: days === -1 ? 'due yesterday' : `${-days} days late`, tone: 'late' }
  if (days === 0) return { text: 'due today', tone: 'soon' }
  if (days === 1) return { text: 'due tomorrow', tone: 'soon' }
  return { text: `in ${days} days`, tone: days <= 3 ? 'soon' : 'later' }
}
