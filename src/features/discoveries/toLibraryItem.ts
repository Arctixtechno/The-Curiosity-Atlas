import type { LibraryItem } from '../../services/library.ts'
import type { Discovery } from './types.ts'

export const libraryId = (d: Discovery) => `discovery:${d.id}`

export function toLibraryItem(d: Discovery): Omit<LibraryItem, 'savedAt'> {
  return {
    id: libraryId(d),
    kind: 'discovery',
    title: d.question,
    topic: d.topic,
    summary: d.answer,
    body: [d.explanation, d.more],
    source: d.source,
  }
}
