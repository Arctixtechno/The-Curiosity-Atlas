/** Subjects from spec section 5.1. */
export type Topic =
  | 'Science'
  | 'Engineering'
  | 'History'
  | 'Geography'
  | 'Biology'
  | 'Psychology'
  | 'Culture'
  | 'Philosophy'
  | 'Technology'

export interface Source {
  title: string
  url: string
}

/** One reviewed entry in the curated discovery database. */
export interface Discovery {
  id: string
  topic: Topic
  /** Asked first, before the answer is revealed. */
  question: string
  /** Short answer shown on reveal. */
  answer: string
  explanation: string
  /** Extra detail for "Tell me more". */
  more: string
  /** Related concepts to explore next. */
  related: string[]
  source: Source
}
